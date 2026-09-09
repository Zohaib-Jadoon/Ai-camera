import { RecordingService } from './recording.service';
import { recordingPrivacy } from './privacy-policy';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';

describe('Recording outage recovery', () => {
  let directory: string;
  let service: RecordingService;
  let row: any;
  const recording = { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), create: jest.fn() };
  const camera = { findUniqueOrThrow: jest.fn() };
  const privacyMask = { findMany: jest.fn() };
  const s3 = { isEnabled: () => true, uploadFile: jest.fn(), verifiedDownload: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks();
    directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'madad-recording-test-'));
    service = new RecordingService({ recording, privacyMask, camera } as any, s3 as any,
      new ConfigService({ TEMP_RECORDINGS_DIR: directory, CAMERA_ENCRYPTION_KEY: 'a'.repeat(64), JWT_SECRET: 'test-only-secret' }));
    row = { id: 'aaaa', camera_id: 'cam', filepath: path.join(directory, 'aaaa.mp4'), privacy_hash: recordingPrivacy([]).hash };
    recording.findMany.mockResolvedValue([row]);
    recording.update.mockResolvedValue({});
    privacyMask.findMany.mockResolvedValue([]);
    await fs.promises.writeFile(row.filepath, 'test clip bytes');
    await fs.promises.writeFile(`${row.filepath}.complete`, '');
  });
  afterEach(async () => {
    service.onModuleDestroy();
    // Only remove this test's freshly-created directory.
    if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith('madad-recording-test-')) throw new Error('Unexpected test directory');
    await fs.promises.rm(directory, { recursive: true, force: true });
  });
  it('preserves the completed spool on storage outage and publishes after recovery', async () => {
    s3.uploadFile.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    await service.recoverPending();
    expect(fs.existsSync(row.filepath)).toBe(true);
    expect(recording.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'READY' }) }));
    await service.recoverPending();
    expect(s3.verifiedDownload).toHaveBeenCalledWith('recordings/aaaa.mp4', createHash('sha256').update('test clip bytes').digest('hex'), expect.any(Number));
    expect(fs.existsSync(row.filepath)).toBe(false);
  });
  it('rejects a full disk before creating metadata or starting capture', async () => {
    camera.findUniqueOrThrow.mockResolvedValue({ rtsp_url: 'rtsp://camera.example/live', privacyMasks: [] });
    const space = jest.spyOn(fs.promises, 'statfs').mockResolvedValue({ bavail: 0, bsize: 4096 } as any);
    try {
      await expect(service.startClip('cam', 'person')).rejects.toThrow('spool is full');
      expect(recording.create).not.toHaveBeenCalled();
    } finally { space.mockRestore(); }
  });
  it('does not publish corrupted object storage bytes', async () => {
    s3.verifiedDownload.mockRejectedValue(new Error('hash mismatch'));
    await service.recoverPending();
    expect(fs.existsSync(row.filepath)).toBe(true);
    expect(recording.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'READY' }) }));
  });
  it('keeps completed footage after a database outage', async () => {
    recording.findMany.mockRejectedValueOnce(new Error('database offline'));
    await service.recoverPending();
    expect(fs.existsSync(row.filepath)).toBe(true);
    await service.recoverPending();
    expect(s3.uploadFile).toHaveBeenCalledTimes(1);
  });
  it('does not publish incomplete footage after a process crash', async () => {
    await fs.promises.unlink(`${row.filepath}.complete`);
    await service.recoverPending();
    expect(recording.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'FAILED', failure_code: 'INTERRUPTED' } });
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });
  it('does not publish a completed clip under a changed privacy policy', async () => {
    privacyMask.findMany.mockResolvedValue([{ x: 0, y: 0, width: 1, height: 1 }]);
    await service.recoverPending();
    expect(recording.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'FAILED', failure_code: 'PRIVACY_CHANGED' } });
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });
  it('continues recovery after an unsafe spool reference', async () => {
    recording.findMany.mockResolvedValue([{ ...row, filepath: path.join(directory, '..', 'outside.mp4') }, row]);
    await service.recoverPending();
    expect(s3.uploadFile).toHaveBeenCalledTimes(1);
    expect(recording.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'READY' }) }));
  });
  it('withholds READY if privacy changes during upload', async () => {
    privacyMask.findMany.mockResolvedValueOnce([]).mockResolvedValue([{ x: 0, y: 0, width: 1, height: 1 }]);
    await service.recoverPending();
    expect(recording.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', failure_code: 'PRIVACY_CHANGED', object_key: 'recordings/aaaa.mp4' }) }));
    expect(recording.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'READY' }) }));
    expect(fs.existsSync(row.filepath)).toBe(true);
  });
  it('withholds bytes if privacy changes during download', async () => {
    recording.findUniqueOrThrow.mockResolvedValue({ ...row, status: 'READY', object_key: 'recordings/aaaa.mp4', sha256: 'hash' });
    privacyMask.findMany.mockResolvedValueOnce([]).mockResolvedValue([{ x: 0, y: 0, width: 1, height: 1 }]);
    s3.verifiedDownload.mockResolvedValue(Buffer.from('verified'));
    await expect(service.download(row.id)).rejects.toThrow('integrity or storage unavailable');
  });
  it('retains spool when final READY database update fails and retries safely', async () => {
    recording.update.mockImplementation(async ({ data }) => { if (data.status === 'READY') throw new Error('database outage'); });
    await service.recoverPending();
    expect(fs.existsSync(row.filepath)).toBe(true);
    recording.update.mockResolvedValue({});
    await service.recoverPending();
    expect(fs.existsSync(row.filepath)).toBe(false);
  });
});
