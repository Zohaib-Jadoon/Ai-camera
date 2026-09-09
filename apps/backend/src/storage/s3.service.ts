import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const accessKey = this.config.get<string>('S3_ACCESS_KEY');
    const secretKey = this.config.get<string>('S3_SECRET_KEY');
    this.bucket = this.config.get<string>('S3_BUCKET', 'madad-snapshots');
    this.enabled = !!(endpoint && accessKey && secretKey);

    if (this.enabled) {
      this.client = new S3Client({
        endpoint: endpoint!,
        region,
        credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
        forcePathStyle: true, // Required for MinIO
        maxAttempts: 3,
        requestHandler: { connectionTimeout: 3000, requestTimeout: 15000 },
      });
      this.logger.log(`S3/MinIO connected: ${endpoint}, bucket=${this.bucket}`);
    } else {
      this.logger.warn('S3/MinIO not configured — falling back to local filesystem');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async upload(key: string, buffer: Buffer, contentType = 'application/octet-stream'): Promise<string> {
    if (!this.enabled) throw new Error('S3 not configured');

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.enabled) throw new Error('S3 not configured');

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  async delete(key: string): Promise<void> {
    if (!this.enabled) throw new Error('S3 not configured');
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async uploadFile(key: string, filepath: string, size: number, sha256: string) {
    if (!this.enabled) throw new Error('S3 not configured');
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: key, Body: createReadStream(filepath),
      ContentLength: size, ContentType: 'video/mp4', Metadata: { sha256 },
    }));
  }

  async verifiedDownload(key: string, expectedHash: string, maxBytes = 128 * 1024 * 1024): Promise<Buffer> {
    if (!this.enabled) throw new Error('S3 not configured');
    const controller = new AbortController();
    let body: any;
    const timeout = setTimeout(() => {
      controller.abort();
      body?.destroy?.(new Error('Recording download timed out'));
    }, 30_000);
    timeout.unref();
    try {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal: controller.signal });
    if (!result.Body) throw new Error('Object body missing');
    body = result.Body;
    if (result.ContentLength !== undefined && result.ContentLength > maxBytes) throw new Error('Recording exceeds size limit');
    const chunks: Buffer[] = [];
    let size = 0;
    const hash = createHash('sha256');
    for await (const chunk of result.Body as any) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) throw new Error('Recording exceeds size limit');
      hash.update(buffer);
      chunks.push(buffer);
    }
    if (hash.digest('hex') !== expectedHash) throw new Error('Recording integrity mismatch');
    return Buffer.concat(chunks);
    } finally {
      clearTimeout(timeout);
      body?.destroy?.();
    }
  }
}
