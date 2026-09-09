import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export function validateCameraUrl(value: string): URL {
  try {
    if (typeof value !== 'string' || value.length > 4096 || /[\r\n\0]/.test(value)) throw new Error();
    const url = new URL(value);
    if (!['rtsp:', 'rtsps:'].includes(url.protocol) || !url.hostname || url.hash ||
        decodeURIComponent(url.username).includes('***') || decodeURIComponent(url.password).includes('***')) throw new Error();
    return url;
  } catch { throw new BadRequestException('A valid RTSP URL with actual camera credentials is required'); }
}

/** Versioned authenticated encryption. Legacy reads are explicit migration support. */
export class CameraCredentials {
  private readonly keys: Record<string, Buffer>;
  private readonly keyId: string;
  private readonly legacySecret?: string;

  constructor(config: ConfigService) {
    this.keyId = config.get<string>('CAMERA_ENCRYPTION_KEY_ID', 'primary');
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(this.keyId)) throw new Error('Invalid CAMERA_ENCRYPTION_KEY_ID');
    const current = config.getOrThrow<string>('CAMERA_ENCRYPTION_KEY');
    const previous = JSON.parse(config.get<string>('CAMERA_ENCRYPTION_PREVIOUS_KEYS') || '{}');
    if (!previous || typeof previous !== 'object' || Array.isArray(previous)) throw new Error('Invalid camera key ring');
    const configured: Record<string, unknown> = { ...previous, [this.keyId]: current };
    this.keys = Object.create(null);
    for (const [id, value] of Object.entries(configured)) {
      if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id) || typeof value !== 'string' || !/^[a-fA-F0-9]{64}$/.test(value)) {
        throw new Error('Camera encryption keys must be 32-byte hex values with valid IDs');
      }
      this.keys[id] = Buffer.from(value, 'hex');
    }
    if (config.get<string>('ALLOW_LEGACY_CAMERA_CREDENTIALS', 'true') === 'true') {
      this.legacySecret = config.getOrThrow<string>('JWT_SECRET');
    }
  }

  encrypt(value: string): string {
    validateCameraUrl(value);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keys[this.keyId], iv);
    cipher.setAAD(Buffer.from(`madad-camera:v2:${this.keyId}`));
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['v2', this.keyId, iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
  }

  decrypt(value: string): string {
    try {
      let plain: string;
      if (value.startsWith('v2:')) {
        const [version, id, iv, tag, encrypted, extra] = value.split(':');
        if (extra !== undefined || !this.keys[id] || !/^[a-f0-9]{24}$/.test(iv) ||
            !/^[a-f0-9]{32}$/.test(tag) || !/^(?:[a-f0-9]{2})+$/.test(encrypted)) throw new Error();
        const decipher = createDecipheriv('aes-256-gcm', this.keys[id], Buffer.from(iv, 'hex'));
        decipher.setAAD(Buffer.from(`madad-camera:${version}:${id}`));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        plain = Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
      } else if (this.legacySecret) {
        if (/^rtsps?:\/\//.test(value)) plain = value;
        else {
          const [iv, encrypted, extra] = value.split(':');
          if (extra !== undefined || !/^[a-f0-9]{32}$/.test(iv) || !/^(?:[a-f0-9]{32})+$/.test(encrypted)) throw new Error();
          const key = createHash('sha256').update(this.legacySecret).digest();
          const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
          plain = Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
        }
      } else throw new Error();
      validateCameraUrl(plain);
      return plain;
    } catch { throw new ServiceUnavailableException('Camera credentials are unavailable; verify the encryption key configuration'); }
  }
}
