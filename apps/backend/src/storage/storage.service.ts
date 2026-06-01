import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storagePath: string;

  constructor(
    private readonly config: ConfigService,
    private readonly s3: S3Service,
  ) {
    this.storagePath = config.get<string>('STORAGE_PATH', './snapshots');
    this.ensureDirectory(this.storagePath);
  }

  private sanitizeCameraId(cameraId: string): string {
    const safe = cameraId.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (safe !== cameraId) {
      this.logger.warn(`Camera ID sanitized from "${cameraId}" to "${safe}"`);
    }
    return safe;
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger.log(`Created storage directory: ${dir}`);
    }
  }

  async saveSnapshot(
    cameraId: string,
    imageBuffer: Buffer,
    extension = 'jpg',
  ): Promise<string> {
    const safeCameraId = this.sanitizeCameraId(cameraId);
    const filename = `${Date.now()}.${extension}`;
    const s3Key = `snapshots/${safeCameraId}/${filename}`;

    // Upload to S3/MinIO if configured
    if (this.s3.isEnabled()) {
      try {
        await this.s3.upload(s3Key, imageBuffer, `image/${extension}`);
        const publicUrl = await this.s3.getSignedDownloadUrl(s3Key, 86400);
        this.logger.debug(`Snapshot uploaded to S3: ${s3Key}`);
        return publicUrl;
      } catch (err) {
        this.logger.warn(`S3 upload failed, falling back to local: ${err.message}`);
      }
    }

    // Fallback to local filesystem
    const cameraDir = path.join(this.storagePath, safeCameraId);
    this.ensureDirectory(cameraDir);
    const filepath = path.join(cameraDir, filename);
    await fs.promises.writeFile(filepath, imageBuffer);
    const publicUrl = `/storage/snapshot/${safeCameraId}/${filename}`;
    this.logger.debug(`Snapshot saved locally: ${publicUrl}`);
    return publicUrl;
  }

  async saveSnapshotBase64(cameraId: string, base64Data: string): Promise<string> {
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (matches) {
      const [, ext, data] = matches;
      return this.saveSnapshot(cameraId, Buffer.from(data, 'base64'), ext);
    }
    return this.saveSnapshot(cameraId, Buffer.from(base64Data, 'base64'));
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  getLocalFilepath(cameraId: string, filename: string): string {
    const safeCameraId = this.sanitizeCameraId(cameraId);
    return path.join(this.storagePath, safeCameraId, filename);
  }
}
