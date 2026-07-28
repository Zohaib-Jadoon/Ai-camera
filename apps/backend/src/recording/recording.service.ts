/**
 * RecordingService — Event-triggered recording stored directly in PostgreSQL database.
 *
 * Flow:
 *   1. AI Engine emits `start_recording` Socket.IO event when a detection fires.
 *   2. EventsGateway calls `startClip()` which creates a Recording row and spawns FFmpeg.
 *   3. FFmpeg records to a temporary file, which is then read into a binary Buffer,
 *      stored directly into the `Recording.video_data` byte column in PostgreSQL DB,
 *      and the temporary local file is deleted immediately.
 *   4. Scheduled purge job removes old database rows beyond the retention window.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';

const TEMP_RECORDINGS_DIR =
  process.env.TEMP_RECORDINGS_DIR ?? path.join(process.cwd(), 'temp_recordings');

@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);

  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(TEMP_RECORDINGS_DIR)) {
      fs.mkdirSync(TEMP_RECORDINGS_DIR, { recursive: true });
    }
  }

  /**
   * Create a Recording row in DB and record an FFmpeg clip into database binary storage.
   */
  async startClip(
    cameraId: string,
    trigger: string,
    durationSec = 30,
    rtspUrl?: string,
  ) {
    const startedAt = new Date();
    const tempFilename = `temp_${cameraId}_${startedAt.getTime()}.mp4`;
    const tempFilepath = path.join(TEMP_RECORDINGS_DIR, tempFilename);

    const recording = await this.prisma.recording.create({
      data: {
        camera_id: cameraId,
        trigger,
        started_at: startedAt,
        duration_sec: durationSec,
      },
    });

    this.logger.log(
      `Recording started for DB: ID=${recording.id} [trigger=${trigger}, duration=${durationSec}s]`,
    );

    if (rtspUrl && ffmpegPath) {
      try {
        ffmpeg(rtspUrl)
          .setFfmpegPath(ffmpegPath)
          .inputOptions('-rtsp_transport', 'tcp')
          .outputOptions(['-t', `${durationSec}`, '-c:v', 'copy', '-an'])
          .output(tempFilepath)
          .on('end', async () => {
            try {
              if (fs.existsSync(tempFilepath)) {
                const buffer = fs.readFileSync(tempFilepath);
                await this.prisma.recording.update({
                  where: { id: recording.id },
                  data: {
                    ended_at: new Date(),
                    size_bytes: buffer.length,
                    video_data: buffer,
                  },
                });

                // Immediately clean up temporary local file
                fs.unlinkSync(tempFilepath);

                this.logger.log(
                  `Recording stored in Database: ID=${recording.id} (${buffer.length} bytes)`,
                );
              }
            } catch (err: any) {
              this.logger.error(
                `Database recording save error: ${err.message}`,
              );
            }
          })
          .on('error', (err) => {
            this.logger.error(`Recording FFmpeg error: ${err.message}`);
            if (fs.existsSync(tempFilepath)) {
              fs.unlinkSync(tempFilepath);
            }
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
   * Delete Recording database rows older than `retentionDays`.
   */
  async purgeOldClips(retentionDays = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.prisma.recording.deleteMany({
      where: { started_at: { lt: cutoff } },
    });

    this.logger.log(
      `Database purge: removed ${result.count} clips older than ${retentionDays} days`,
    );
    return result.count;
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
      select: {
        id: true,
        camera_id: true,
        trigger: true,
        duration_sec: true,
        size_bytes: true,
        started_at: true,
        ended_at: true,
        createdAt: true,
      },
      orderBy: { started_at: 'desc' },
      take: limit,
    });
  }

  /** List all recordings with optional trigger filter. */
  async findAll(trigger?: string, limit = 100) {
    return this.prisma.recording.findMany({
      where: trigger ? { trigger } : undefined,
      select: {
        id: true,
        camera_id: true,
        trigger: true,
        duration_sec: true,
        size_bytes: true,
        started_at: true,
        ended_at: true,
        createdAt: true,
        camera: { select: { name: true, location: true } },
      },
      orderBy: { started_at: 'desc' },
      take: limit,
    });
  }
}
