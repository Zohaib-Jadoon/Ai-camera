import { BadRequestException, Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { CameraCredentials } from '../common/utils/camera-credentials';
import { recordingPrivacy } from './privacy-policy';
import { createHash, randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';

const MAX_BYTES = 128 * 1024 * 1024;
const summary = { id: true, camera_id: true, trigger: true, duration_sec: true,
  size_bytes: true, started_at: true, ended_at: true, createdAt: true,
  status: true, failure_code: true, sha256: true } as const;

/** Single recorder instance with a persistent spool. No unmasked local fallback. */
@Injectable()
export class RecordingService implements OnModuleDestroy {
  private readonly logger = new Logger(RecordingService.name);
  private active = new Map<string, ffmpeg.FfmpegCommand | null>();
  private cooldown = new Map<string, number>();
  private recovering = false;
  private stopping = false;
  private readonly spool: string;

  constructor(private readonly prisma: PrismaService, private readonly s3: S3Service,
    private readonly config: ConfigService) {
    this.spool = path.resolve(config.get('TEMP_RECORDINGS_DIR', './temp_recordings'));
    fs.mkdirSync(this.spool, { recursive: true });
  }

  async startClip(cameraId: string, trigger: string, durationSec = 30, _ignoredEngineUrl?: string) {
    if (!Number.isInteger(durationSec) || durationSec < 1 || durationSec > 120 ||
        typeof trigger !== 'string' || trigger.length > 120) throw new BadRequestException('Invalid recording request');
    if (this.stopping || this.active.has(cameraId) || Date.now() - (this.cooldown.get(cameraId) ?? 0) < 60_000) return null;
    if (!this.s3.isEnabled()) throw new ServiceUnavailableException('Recording object storage is not configured');
    if (this.active.size >= 4) throw new ServiceUnavailableException('Recording capacity reached');
    this.active.set(cameraId, null);
    try {
      const camera = await this.prisma.camera.findUniqueOrThrow({ where: { id: cameraId }, include: { privacyMasks: true } });
      const policy = recordingPrivacy(camera.privacyMasks);
      const url = new CameraCredentials(this.config).decrypt(camera.record_url || camera.rtsp_url);
      const space = await fs.promises.statfs(this.spool);
      if (space.bavail * space.bsize < MAX_BYTES * 2) throw new ServiceUnavailableException('Recording spool is full');
      const id = randomUUID();
      const filepath = path.join(this.spool, `${id}.mp4`);
      const recording = await this.prisma.recording.create({ data: {
        id, camera_id: cameraId, trigger, started_at: new Date(), duration_sec: durationSec,
        status: 'RECORDING', filepath, privacy_hash: policy.hash,
      } });
      for (const [id, time] of this.cooldown) if (Date.now() - time > 60_000) this.cooldown.delete(id);
      this.cooldown.set(cameraId, Date.now());
      void this.capture(recording, url, policy.filters).finally(() => this.active.delete(cameraId));
      return recording;
    } catch (error) {
      this.active.delete(cameraId);
      throw error;
    }
  }

  private async capture(recording: any, url: string, filters: string[]) {
    try {
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg(url).setFfmpegPath(this.config.get('FFMPEG_PATH', ffmpegPath))
          .inputOptions(['-rtsp_transport', 'tcp', '-rw_timeout', '10000000'])
          .outputOptions(['-t', String(recording.duration_sec), '-fs', String(MAX_BYTES), '-an',
            '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'])
          .output(recording.filepath);
        if (filters.length) command.videoFilters(filters);
        const timeout = setTimeout(() => { command.kill('SIGKILL'); reject(new Error('timeout')); },
          (recording.duration_sec + 20) * 1000);
        command.on('end', () => { clearTimeout(timeout); resolve(); });
        command.on('error', () => { clearTimeout(timeout); reject(new Error('capture failed')); });
        this.active.set(recording.camera_id, command);
        try { command.run(); } catch { clearTimeout(timeout); reject(new Error('capture failed')); }
      });
      // A marker proves FFmpeg completed; survive a DB outage immediately after capture.
      const clip = await fs.promises.open(recording.filepath, 'r+');
      try { await clip.sync(); } finally { await clip.close(); }
      const marker = await fs.promises.open(`${recording.filepath}.complete`, 'wx');
      try { await marker.sync(); } finally { await marker.close(); }
      await this.publish(recording);
    } catch {
      this.logger.warn('Recording incomplete or pending recovery');
      const complete = fs.existsSync(`${recording.filepath}.complete`);
      await this.prisma.recording.update({ where: { id: recording.id }, data: {
        status: complete ? 'UPLOADING' : 'FAILED', failure_code: complete ? 'STORAGE_RETRY' : 'CAPTURE_FAILED',
      } }).catch(() => {});
    }
  }

  private safeSpool(filepath: string) {
    const resolved = path.resolve(filepath);
    if (path.dirname(resolved) !== this.spool || !/^[a-f0-9-]+\.mp4$/.test(path.basename(resolved))) {
      throw new Error('Invalid spool reference');
    }
    return resolved;
  }

  private async publish(recording: any) {
    const filepath = this.safeSpool(recording.filepath);
    if (!fs.existsSync(`${filepath}.complete`)) throw new Error('Capture incomplete');
    const masks = await this.prisma.privacyMask.findMany({ where: { camera_id: recording.camera_id } });
    if (recordingPrivacy(masks).hash !== recording.privacy_hash) {
      await this.prisma.recording.update({ where: { id: recording.id }, data: { status: 'FAILED', failure_code: 'PRIVACY_CHANGED' } });
      return;
    }
    const stat = await fs.promises.stat(filepath);
    if (!stat.size || stat.size >= MAX_BYTES) throw new Error('Invalid clip size');
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(filepath)) hash.update(chunk);
    const sha256 = hash.digest('hex');
    const key = `recordings/${recording.id}.mp4`;
    await this.prisma.recording.update({ where: { id: recording.id }, data: { status: 'UPLOADING' } });
    await this.s3.uploadFile(key, filepath, stat.size, sha256);
    // Read back and verify persisted bytes, not just an upload response/ETag.
    await this.s3.verifiedDownload(key, sha256, MAX_BYTES);
    // Masks may change during a slow upload/readback. Never mark such a clip READY.
    const currentMasks = await this.prisma.privacyMask.findMany({ where: { camera_id: recording.camera_id } });
    if (recordingPrivacy(currentMasks).hash !== recording.privacy_hash) {
      await this.prisma.recording.update({ where: { id: recording.id }, data: {
        status: 'FAILED', failure_code: 'PRIVACY_CHANGED', object_key: key,
      } });
      return;
    }
    await this.prisma.recording.update({ where: { id: recording.id }, data: {
      status: 'READY', object_key: key, sha256, size_bytes: stat.size,
      ended_at: (await fs.promises.stat(`${filepath}.complete`)).mtime, failure_code: null,
    } });
    await fs.promises.unlink(filepath).catch(() => {});
    await fs.promises.unlink(`${filepath}.complete`).catch(() => {});
  }

  @Cron('*/30 * * * * *')
  async recoverPending() {
    if (this.recovering || this.stopping || !this.s3.isEnabled()) return;
    this.recovering = true;
    try {
      const pending = await this.prisma.recording.findMany({ where: { status: { in: ['RECORDING', 'UPLOADING'] } }, take: 50, orderBy: { started_at: 'asc' } });
      for (const recording of pending) {
        if (this.active.has(recording.camera_id)) continue;
        try {
        if (recording.filepath && fs.existsSync(`${this.safeSpool(recording.filepath)}.complete`)) {
          await this.publish(recording).catch(() => this.logger.warn('Recording storage retry pending'));
        } else {
          await this.prisma.recording.update({ where: { id: recording.id }, data: { status: 'FAILED', failure_code: 'INTERRUPTED' } });
        }
        } catch { this.logger.warn('Recording recovery item failed; continuing batch'); }
      }
    } catch { this.logger.warn('Recording recovery unavailable'); }
    finally { this.recovering = false; }
  }

  async download(id: string) {
    const recording = await this.prisma.recording.findUniqueOrThrow({ where: { id } });
    const masks = await this.prisma.privacyMask.findMany({ where: { camera_id: recording.camera_id } });
    if (recording.status !== 'READY' || !recording.object_key || !recording.sha256 ||
        recordingPrivacy(masks).hash !== recording.privacy_hash) {
      throw new ServiceUnavailableException('Recording is not verified under the current privacy policy');
    }
    try {
      const buffer = await this.s3.verifiedDownload(recording.object_key, recording.sha256);
      const latestMasks = await this.prisma.privacyMask.findMany({ where: { camera_id: recording.camera_id } });
      if (recordingPrivacy(latestMasks).hash !== recording.privacy_hash) {
        throw new Error('Privacy policy changed during download');
      }
      return { buffer, sha256: recording.sha256 };
    } catch { throw new ServiceUnavailableException('Recording integrity or storage unavailable'); }
  }

  async purgeOldClips(days = 7) {
    if (!Number.isInteger(days) || days < 1 || days > 3650) throw new BadRequestException('Retention must be an integer between 1 and 3650 days');
    const rows = await this.prisma.recording.findMany({ where: {
      started_at: { lt: new Date(Date.now() - days * 86400000) }, status: { in: ['READY', 'FAILED', 'LEGACY'] },
    }, take: 100 });
    let count = 0;
    for (const row of rows) {
      if (row.object_key) await this.s3.delete(row.object_key);
      if (row.filepath && row.status !== 'LEGACY') {
        const filepath = this.safeSpool(row.filepath);
        for (const target of [filepath, `${filepath}.complete`]) {
          await fs.promises.unlink(target).catch((e) => { if (e.code !== 'ENOENT') throw e; });
        }
      }
      await this.prisma.recording.delete({ where: { id: row.id } });
      count++;
    }
    return count;
  }

  findById(id: string) { return this.prisma.recording.findUnique({ where: { id } }); }
  findByCamera(cameraId: string, limit = 50) { return this.list({ camera_id: cameraId }, limit); }
  findAll(trigger?: string, limit = 100) { return this.list(trigger ? { trigger } : {}, limit); }
  private async list(where: any, limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new BadRequestException('Limit must be an integer between 1 and 500');
    return this.prisma.recording.findMany({ where, select: { ...summary, camera: { select: { name: true, location: true } } }, orderBy: { started_at: 'desc' }, take: limit });
  }

  onModuleDestroy() {
    this.stopping = true;
    for (const command of this.active.values()) command?.kill('SIGKILL');
  }
}
