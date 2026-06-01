import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
    if (!this.enabled) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
