import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { RecordingController } from './recording.controller';
import { RecordingService } from './recording.service';
import { ConfigService } from '@nestjs/config';
import { recordingPrivacy } from './privacy-policy';

describe('Recording safety', () => {
  const recording = { deleteMany: jest.fn(), delete: jest.fn(), findMany: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn() };
  const camera = { findUniqueOrThrow: jest.fn() };
  const privacyMask = { findMany: jest.fn() };
  const s3 = { isEnabled: () => true, delete: jest.fn(), verifiedDownload: jest.fn() };
  let service: RecordingService;
  beforeEach(() => {
    jest.resetAllMocks();
    service = new RecordingService({ recording, camera, privacyMask } as any, s3 as any, new ConfigService());
  });

  it('does not expose destructive purge through GET', () => {
    expect(Reflect.getMetadata(METHOD_METADATA, RecordingController.prototype.purge)).toBe(RequestMethod.POST);
  });

  it.each([0, -1, 0.5, NaN, Infinity, 3651])('rejects unsafe retention %s before deletion', async (days) => {
    await expect(service.purgeOldClips(days)).rejects.toThrow('Retention');
    expect(recording.deleteMany).not.toHaveBeenCalled();
  });

  it('accepts bounded retention', async () => {
    recording.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    recording.delete.mockResolvedValue({});
    await expect(service.purgeOldClips(30)).resolves.toBe(2);
  });

  it.each([0, -1, 501, 1.5])('bounds list sizes %s', async (limit) => {
    await expect(service.findAll(undefined, limit)).rejects.toThrow('Limit');
    await expect(service.findByCamera('camera', limit)).rejects.toThrow('Limit');
    expect(recording.findMany).not.toHaveBeenCalled();
  });

  it('releases camera reservation after database failure so retries can proceed', async () => {
    camera.findUniqueOrThrow.mockRejectedValue(new Error('database unavailable'));
    await expect(service.startClip('camera', 'motion')).rejects.toThrow();
    await expect(service.startClip('camera', 'motion')).rejects.toThrow();
    expect(camera.findUniqueOrThrow).toHaveBeenCalledTimes(2);
  });

  it('retains metadata when object deletion fails', async () => {
    recording.findMany.mockResolvedValue([{ id: 'a', object_key: 'recordings/a.mp4' }]);
    s3.delete.mockRejectedValue(new Error('storage offline'));
    await expect(service.purgeOldClips(30)).rejects.toThrow();
    expect(recording.delete).not.toHaveBeenCalled();
  });

  it('blocks old/unverified recordings rather than serving an unmasked fallback', async () => {
    recording.findUniqueOrThrow.mockResolvedValue({ status: 'LEGACY', camera_id: 'a', video_data: Buffer.from('private') });
    privacyMask.findMany.mockResolvedValue([]);
    await expect(service.download('a')).rejects.toThrow('not verified');
    expect(s3.verifiedDownload).not.toHaveBeenCalled();
  });

  it('blocks footage after privacy policy changes', async () => {
    recording.findUniqueOrThrow.mockResolvedValue({ status: 'READY', object_key: 'a', sha256: 'a', privacy_hash: recordingPrivacy([]).hash });
    privacyMask.findMany.mockResolvedValue([{ x: 0, y: 0, width: 0.5, height: 0.5 }]);
    await expect(service.download('a')).rejects.toThrow('not verified');
  });

  it('rejects malformed masks and rounds coverage outward', () => {
    expect(() => recordingPrivacy([{ x: 0.8, y: 0, width: 0.5, height: 1 }])).toThrow();
    expect(recordingPrivacy([{ x: 0.1, y: 0, width: 0.5, height: 1 }]).filters[0]).toContain('ceil(iw*0.5)+1');
  });
});
