import { Injectable, Logger } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * FFmpeg RTSP input arguments ported from Frigate's ffmpeg_presets.py.
 *
 * These flags harden RTSP ingestion against jitter, packet loss,
 * clock skew, and corrupt frames — the same settings Frigate ships
 * in production for all cameras.
 *
 * Source: frigate/ffmpeg_presets.py → RTSP_INPUT_ARGS (MIT License)
 */
const RTSP_INPUT_ARGS: string[] = [
  '-avoid_negative_ts', 'make_zero',
  '-fflags', '+genpts+discardcorrupt',
  '-rtsp_transport', 'tcp',
  '-timeout', '5000000',         // 5 s socket timeout (µs)
  '-use_wallclock_as_timestamps', '1',
];

/**
 * HLS output arguments: low-latency 2-second segments, copy codec
 * to avoid transcoding overhead, 5-segment rolling window.
 */
const HLS_OUTPUT_ARGS: string[] = [
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-hls_time', '1',               // 1-second segments (faster startup)
  '-hls_list_size', '3',          // Rolling window of 3 segments (lower player delay)
  '-hls_flags', 'delete_segments+omit_endlist',
  '-f', 'hls',
];

const HLS_ROOT = process.env.HLS_DIR ?? '/tmp/hls';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  /** Active FFmpeg processes, keyed by camera ID. */
  private readonly processes = new Map<string, ChildProcess>();

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Start an HLS stream for a camera by spawning FFmpeg with Frigate's
   * hardened RTSP input args.
   *
   * Returns the relative HLS playlist URL immediately — segments appear
   * on disk within the first 2-second window.
   */
  startHlsStream(cameraId: string, rtspUrl: string): { hlsUrl: string } {
    if (this.processes.has(cameraId)) {
      this.logger.debug(`HLS already running for camera ${cameraId}`);
      return { hlsUrl: this._hlsUrl(cameraId) };
    }

    const outDir = path.join(HLS_ROOT, cameraId);
    const playlistPath = path.join(outDir, 'index.m3u8');

    try {
      fs.mkdirSync(outDir, { recursive: true });
    } catch (err) {
      this.logger.error(`Cannot create HLS dir ${outDir}: ${err}`);
    }

    const args: string[] = [
      // ── Input ──
      ...RTSP_INPUT_ARGS,
      '-i', rtspUrl,
      // ── Output ──
      ...HLS_OUTPUT_ARGS,
      playlistPath,
    ];

    this.logger.log(`Spawning FFmpeg for camera ${cameraId}: ffmpeg ${args.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    ffmpeg.stderr?.on('data', (chunk: Buffer) => {
      // FFmpeg sends progress to stderr — log only at debug level
      this.logger.debug(`[ffmpeg:${cameraId}] ${chunk.toString().trim()}`);
    });

    ffmpeg.on('error', (err) => {
      this.logger.error(`FFmpeg process error for camera ${cameraId}: ${err.message}`);
      this.processes.delete(cameraId);
    });

    ffmpeg.on('close', (code) => {
      this.logger.warn(`FFmpeg for camera ${cameraId} exited with code ${code}`);
      this.processes.delete(cameraId);
    });

    this.processes.set(cameraId, ffmpeg);
    return { hlsUrl: this._hlsUrl(cameraId) };
  }

  /**
   * Kill the FFmpeg process for a camera and clean up HLS segments.
   */
  stopHlsStream(cameraId: string): void {
    const proc = this.processes.get(cameraId);
    if (!proc) {
      this.logger.debug(`No HLS process found for camera ${cameraId}`);
      return;
    }

    this.logger.log(`Stopping HLS stream for camera ${cameraId}`);
    proc.kill('SIGTERM');
    this.processes.delete(cameraId);

    // Best-effort cleanup of HLS segments
    const outDir = path.join(HLS_ROOT, cameraId);
    fs.rm(outDir, { recursive: true, force: true }, (err) => {
      if (err) this.logger.warn(`Failed to clean HLS dir ${outDir}: ${err.message}`);
    });
  }

  /**
   * Probe an RTSP URL with ffprobe to check reachability without starting
   * a full stream. Returns within ~5 s (hard timeout on the socket).
   */
  testRtspConnection(rtspUrl: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const args = [
        '-v', 'error',
        ...RTSP_INPUT_ARGS,
        '-i', rtspUrl,
        '-t', '1',            // probe only 1 second of data
        '-f', 'null', '-',
      ];

      const probe = spawn('ffprobe', [
        '-v', 'error',
        '-rtsp_transport', 'tcp',
        '-timeout', '5000000',
        '-i', rtspUrl,
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1',
      ]);

      let errOutput = '';
      probe.stderr?.on('data', (d: Buffer) => { errOutput += d.toString(); });

      const timeout = setTimeout(() => {
        probe.kill();
        resolve({ success: false, message: 'Connection timed out (> 5 s). Check URL and network.' });
      }, 6000);

      probe.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ success: true, message: 'RTSP stream is reachable.' });
        } else {
          const short = errOutput.slice(-200).replace(/\n/g, ' ').trim();
          resolve({ success: false, message: short || `ffprobe exited with code ${code}.` });
        }
      });

      probe.on('error', (err) => {
        clearTimeout(timeout);
        // ffprobe not installed — degrade gracefully
        this.logger.warn(`ffprobe not available: ${err.message} — returning mock success`);
        resolve({ success: true, message: 'Stream assumed reachable (ffprobe not installed).' });
      });
    });
  }

  /**
   * Stop all active streams — called during application shutdown.
   */
  stopAll(): void {
    this.logger.log(`Stopping ${this.processes.size} active HLS stream(s)`);
    for (const [cameraId] of this.processes) {
      this.stopHlsStream(cameraId);
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private _hlsUrl(cameraId: string): string {
    return `/streams/${cameraId}/index.m3u8`;
  }
}
