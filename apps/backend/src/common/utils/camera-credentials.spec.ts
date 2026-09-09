import { ConfigService } from '@nestjs/config';
import { createCipheriv, createHash } from 'crypto';
import { CameraCredentials, validateCameraUrl } from './camera-credentials';
import { redactRtsp } from './crypto.utils';

describe('camera credential protection', () => {
  const url = 'rtsp://operator:private@example.invalid:554/token-in-path?secret=private';
  const configuration = { CAMERA_ENCRYPTION_KEY: 'a'.repeat(64), JWT_SECRET: 'legacy-test-key', CAMERA_ENCRYPTION_KEY_ID: 'key1' };
  const cipher = (settings = {}) => new CameraCredentials(new ConfigService({ ...configuration, ...settings }));

  it('encrypts with fresh nonces and authenticates all ciphertext bytes', () => {
    const credentials = cipher();
    const encrypted = credentials.encrypt(url);
    expect(encrypted).not.toContain('private');
    expect(credentials.encrypt(url)).not.toBe(encrypted);
    expect(credentials.decrypt(encrypted)).toBe(url);
    const fields = encrypted.split(':');
    fields[4] = (fields[4][0] === '0' ? '1' : '0') + fields[4].slice(1);
    expect(() => credentials.decrypt(fields.join(':'))).toThrow('Camera credentials are unavailable');
  });

  it('supports previous keys during rotation without falling back on unknown keys', () => {
    const encrypted = cipher().encrypt(url);
    const rotated = cipher({ CAMERA_ENCRYPTION_KEY_ID: 'key2', CAMERA_ENCRYPTION_KEY: 'b'.repeat(64), CAMERA_ENCRYPTION_PREVIOUS_KEYS: JSON.stringify({ key1: 'a'.repeat(64) }) });
    expect(rotated.decrypt(encrypted)).toBe(url);
    expect(rotated.encrypt(url)).toMatch(/^v2:key2:/);
    expect(() => cipher({ CAMERA_ENCRYPTION_KEY: 'b'.repeat(64) }).decrypt(encrypted)).toThrow();
  });

  it('reads valid legacy ciphertext only when explicitly enabled for migration', () => {
    const iv = Buffer.alloc(16, 1);
    const legacy = createCipheriv('aes-256-cbc', createHash('sha256').update(configuration.JWT_SECRET).digest(), iv);
    const encrypted = `${iv.toString('hex')}:${Buffer.concat([legacy.update(url), legacy.final()]).toString('hex')}`;
    expect(cipher().decrypt(encrypted)).toBe(url);
    expect(cipher().decrypt(url)).toBe(url);
    expect(() => cipher({ ALLOW_LEGACY_CAMERA_CREDENTIALS: 'false' }).decrypt(encrypted)).toThrow();
    expect(() => cipher({ ALLOW_LEGACY_CAMERA_CREDENTIALS: 'false' }).decrypt(url)).toThrow();
    expect(() => cipher().decrypt('broken:ciphertext')).toThrow();
  });

  it.each(['file:///etc/passwd', 'http://example.invalid', 'rtsp://***:***@example.invalid/live', 'rtsp://example.invalid/live\n', 'rtsp://example.invalid/live#fragment'])('rejects invalid or masked URLs: %s', (value) => {
    expect(() => validateCameraUrl(value)).toThrow();
  });

  it('never returns credentials or path/query tokens in the display URL', () => {
    expect(redactRtsp(url)).toBe('rtsp://example.invalid:554/[hidden]');
    expect(redactRtsp('unparseable-private-secret')).toBe('[stream configured]');
  });

  it('requires a separate valid encryption key', () => {
    expect(() => new CameraCredentials(new ConfigService({ JWT_SECRET: 'legacy' }))).toThrow();
    expect(() => cipher({ CAMERA_ENCRYPTION_KEY: 'short' })).toThrow();
  });
});
