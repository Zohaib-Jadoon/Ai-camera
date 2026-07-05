/**
 * RecordingService — Frigate-inspired event-triggered recording with retention.
 *
 * Flow:
 *   1. AI Engine emits `start_recording` Socket.IO event when a detection fires.
 *   2. EventsGateway calls `startClip()` which records metadata and kicks off
 *      an FFmpeg process.
 *   3. A periodic job calls `purgeOldClips(retentionDays)` to delete clips
 *      beyond the retention window and free disk/object-storage space.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';

const RECORDINGS_DIR =
  process.env.RECORDINGS_DIR ?? path.join(process.cwd(), 'recordings');

@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);

  constructor(private readonly prisma: PrismaService) {
    // Ensure local recordings directory exists
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }
  }

  /**
   * Create a Recording row and spawn an FFmpeg clip.
   *
   * @param cameraId   Camera that triggered the recording.
   * @param trigger    Detection type that caused the recording (e.g. 'person').
   * @param durationSec How long to record in seconds (default 30).
   * @param rtspUrl    Source URL for FFmpeg — set from the camera's record_url
   *                   (high-res) or rtsp_url as fallback.
   */
  async startClip(
    cameraId: string,
    trigger: string,
    durationSec = 30,
    rtspUrl?: string,
  ) {
    const startedAt = new Date();
    const filename = `${cameraId}_${startedAt.toISOString().replace(/[:.]/g, '-')}.mp4`;
    const filepath = path.join(RECORDINGS_DIR, filename);

    const recording = await this.prisma.recording.create({
      data: {
        camera_id: cameraId,
        trigger,
        filepath,
        started_at: startedAt,
        duration_sec: durationSec,
      },
    });

    this.logger.log(
      `Recording started: ${filename} [trigger=${trigger}, duration=${durationSec}s]`,
    );

    if (rtspUrl && ffmpegPath) {
      try {
        ffmpeg(rtspUrl)
          .setFfmpegPath(ffmpegPath)
          .inputOptions('-rtsp_transport', 'tcp')
          .outputOptions(['-t', `${durationSec}`, '-c:v', 'copy', '-an'])
          .output(filepath)
          .on('end', async () => {
            try {
              const stat = fs.statSync(filepath);
              await this.prisma.recording.update({
                where: { id: recording.id },
                data: { ended_at: new Date(), size_bytes: stat.size },
              });
              this.logger.log(
                `Recording finished: ${filename} (${stat.size} bytes)`,
              );
            } catch (err: any) {
              this.logger.error(
                `Recording post-process error: ${err.message}`,
              );
            }
          })
          .on('error', (err) => {
            this.logger.error(`Recording error: ${err.message}`);
          })
          .run();
      } catch (err: any) {
        this.logger.error(`Failed to spawn FFmpeg: ${err.message}`);
      }
    } else {
      this.logger.warn(
        `Skipping FFmpeg spawn — rtspUrl=${rtspUrl ? 'set' : 'missing'}, ffmpegPath=${ffmpegPath ? 'found' : 'missing'}`,
      );
    }

    return recording;
  }

  /**
   * Delete Recording rows (and local files) older than `retentionDays`.
   * Call this on a schedule (e.g. daily at midnight via a NestJS cron job).
   */
  async purgeOldClips(retentionDays = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const old = await this.prisma.recording.findMany({
      where: { started_at: { lt: cutoff } },
      select: { id: true, filepath: true },
    });

    let deleted = 0;
    for (const rec of old) {
      try {
        if (fs.existsSync(rec.filepath)) {
          fs.unlinkSync(rec.filepath);
        }
        await this.prisma.recording.delete({ where: { id: rec.id } });
        deleted++;
      } catch (err: any) {
        this.logger.warn(`Failed to purge recording ${rec.id}: ${err.message}`);
      }
    }

    this.logger.log(
      `Retention purge: removed ${deleted} clips older than ${retentionDays} days`,
    );
    return deleted;
  }

  /** Find a single recording by ID. */
  async findById(id: string) {
    return this.prisma.recording.findUnique({
      where: { id },
      include: { camera: { select: { name: true, location: true } } },
    });
  }

  /** List recordings for a camera, newest first. */
  async findByCamera(cameraId: string, limit = 50) {
    return this.prisma.recording.findMany({
      where: { camera_id: cameraId },
      orderBy: { started_at: 'desc' },
      take: limit,
    });
  }

  /** List all recordings with optional trigger filter. */
  async findAll(trigger?: string, limit = 100) {
    return this.prisma.recording.findMany({
      where: trigger ? { trigger } : undefined,
      orderBy: { started_at: 'desc' },
      take: limit,
      include: { camera: { select: { name: true, location: true } } },
    });
  }
}
