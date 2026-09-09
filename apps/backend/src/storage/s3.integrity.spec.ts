import { Readable } from 'stream';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

describe('Object integrity verification', () => {
  function storage(bytes: string) {
    const service = new S3Service(new ConfigService());
    Object.assign(service as any, { enabled: true, client: { send: jest.fn().mockResolvedValue({ Body: Readable.from([Buffer.from(bytes)]) }) } });
    return service;
  }
  it('accepts byte-identical objects', async () => {
    const hash = createHash('sha256').update('clip').digest('hex');
    await expect(storage('clip').verifiedDownload('recordings/a', hash)).resolves.toEqual(Buffer.from('clip'));
  });
  it('rejects changed objects', async () => {
    const hash = createHash('sha256').update('clip').digest('hex');
    await expect(storage('tampered').verifiedDownload('recordings/a', hash)).rejects.toThrow('integrity mismatch');
  });
  it('bounds oversized streams', async () => {
    await expect(storage('large').verifiedDownload('recordings/a', '', 2)).rejects.toThrow('size limit');
  });
  it('closes a body rejected from its advertised size', async () => {
    const service = storage('clip');
    const body = new Readable({ read() {} });
    (service as any).client.send.mockResolvedValue({ Body: body, ContentLength: 100 });
    await expect(service.verifiedDownload('recordings/a', '', 2)).rejects.toThrow('size limit');
    expect(body.destroyed).toBe(true);
  });
  it('terminates a stalled body and releases its connection', async () => {
    jest.useFakeTimers();
    try {
      const service = storage('clip');
      const body = new Readable({ read() {} });
      (service as any).client.send.mockResolvedValue({ Body: body });
      const result = expect(service.verifiedDownload('recordings/a', '')).rejects.toThrow('timed out');
      await jest.advanceTimersByTimeAsync(30_001);
      await result;
      expect(body.destroyed).toBe(true);
    } finally { jest.useRealTimers(); }
  });
});
