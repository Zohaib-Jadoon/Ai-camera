import { Injectable, Optional, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Camera, CameraStatus } from '@prisma/client';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { BulkImportCamerasDto } from './dto/bulk-import-cameras.dto';
import { EventsGateway } from '../events/events.gateway';
import { ConfigService } from '@nestjs/config';
import { CameraCredentials, validateCameraUrl } from '../common/utils/camera-credentials';
import { randomUUID } from 'crypto';

// Forward reference avoids circular module dependency
// EventsGateway -> CameraService -> EventsGateway
// Injected as optional so CameraService still works in isolation (tests).
@Injectable()
export class CameraService {
  private readonly credentials: CameraCredentials;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Optional() @Inject(forwardRef(() => EventsGateway)) private gateway?: EventsGateway,
  ) {
    this.credentials = new CameraCredentials(this.configService);
  }

  private decryptCamera(camera: Camera): Camera {
    return {
      ...camera,
      rtsp_url: this.credentials.decrypt(camera.rtsp_url),
      detect_url: camera.detect_url ? this.credentials.decrypt(camera.detect_url) : camera.detect_url,
      record_url: camera.record_url ? this.credentials.decrypt(camera.record_url) : camera.record_url,
    };
  }

  async findAll(): Promise<Camera[]> {
    const cameras = await this.prisma.camera.findMany({
      include: { zones: true },
    });
    return cameras.map((cam) => this.decryptCamera(cam));
  }

  async findOne(id: string): Promise<Camera | null> {
    const camera = await this.prisma.camera.findUnique({
      where: { id },
      include: { zones: true },
    });
    if (!camera) return null;
    return this.decryptCamera(camera);
  }

  async create(dto: CreateCameraDto): Promise<Camera> {
    const camera = await this.prisma.camera.create({
      data: {
        name: dto.name,
        rtsp_url: this.credentials.encrypt(dto.rtsp_url),
        location: dto.location,
        detect_url: dto.detect_url ? this.credentials.encrypt(dto.detect_url) : undefined,
        record_url: dto.record_url ? this.credentials.encrypt(dto.record_url) : undefined,
        ...(dto.sop_name !== undefined ? { sop_name: dto.sop_name } : {}),
        ...(dto.status ? { status: dto.status as any } : {}),
      } as any,
    });
    this.gateway?.broadcastCameraSync().catch(() => {});
    return this.decryptCamera(camera);
  }

  async update(id: string, dto: UpdateCameraDto): Promise<Camera> {
    const camera = await this.prisma.camera.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.rtsp_url ? { rtsp_url: this.credentials.encrypt(dto.rtsp_url) } : {}),
        ...(dto.detect_url ? { detect_url: this.credentials.encrypt(dto.detect_url) } : {}),
        ...(dto.record_url ? { record_url: this.credentials.encrypt(dto.record_url) } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.status ? { status: dto.status as any } : {}),
        ...(dto.sop_name !== undefined ? { sop_name: dto.sop_name } : {}),
      } as any,
    });
    this.gateway?.broadcastCameraSync().catch(() => {});
    return this.decryptCamera(camera);
  }

  async remove(id: string): Promise<Camera> {
    const camera = await this.prisma.camera.delete({ where: { id } });
    this.gateway?.broadcastCameraSync().catch(() => {});
    return this.decryptCamera(camera);
  }

  async updateHealthStatus(
    cameraId: string,
    status: CameraStatus,
  ): Promise<Camera> {
    const camera = await this.prisma.camera.update({
      where: { id: cameraId },
      data: { status, last_seen: new Date() },
    });
    return this.decryptCamera(camera);
  }

  async findUnhealthy(): Promise<Camera[]> {
    const cameras = await this.prisma.camera.findMany({
      where: {
        status: { in: [CameraStatus.OFFLINE, CameraStatus.ERROR] },
      },
      orderBy: { last_seen: 'desc' },
    });
    return cameras.map((cam) => this.decryptCamera(cam));
  }

  async bulkImport(dto: BulkImportCamerasDto): Promise<{ created: number; errors: string[] }> {
    const errors: string[] = [];
    let created = 0;

    for (const item of dto.cameras) {
      try {
        await this.prisma.camera.create({
          data: {
            name: item.name,
            rtsp_url: this.credentials.encrypt(item.rtsp_url),
            location: item.location,
            detect_url: item.detect_url ? this.credentials.encrypt(item.detect_url) : undefined,
            record_url: item.record_url ? this.credentials.encrypt(item.record_url) : undefined,
            group_id: item.group_id,
          },
        });
        created++;
      } catch (err: any) {
        errors.push(`${item.name}: Camera could not be imported; check the stream URL and camera group.`);
      }
    }

    this.gateway?.broadcastCameraSync().catch(() => {});
    return { created, errors };
  }

  /**
   * Test RTSP stream reachability via the AI Engine Socket.IO bridge.
   *
   * Flow:
   *  1. Resolve the RTSP URL from the DB if not provided explicitly.
   *  2. Emit `test_stream` to all connected AI Engine sockets.
   *  3. Wait up to 10 seconds for `stream_test_result` to come back.
   *  4. Return the result to the HTTP caller.
   *
   * If the AI Engine is not connected, returns a graceful error.
   */
  async testConnection(
    id: string,
    rtspUrl?: string,
  ): Promise<{ ok: boolean; message: string; resolution: number[] | null; fps: number | null }> {
    // Resolve RTSP URL
    let url = rtspUrl;
    if (!url) {
      const camera = await this.prisma.camera.findUnique({ where: { id } });
      if (!camera) throw new NotFoundException(`Camera ${id} not found`);
      url = this.credentials.decrypt(camera.rtsp_url);
    }

    const gateway = this.gateway as any;

    // Check whether any AI Engine socket is actually connected
    if (!gateway || typeof gateway.isAiEngineConnected !== 'function' || !gateway.isAiEngineConnected()) {
      return {
        ok: false,
        message: 'AI Engine is not connected — start the AI Engine service first.',
        resolution: null,
        fps: null,
      };
    }

    validateCameraUrl(url);
    const requestId = `test-${randomUUID()}`;

    // Wait for the AI engine to emit stream_test_result with this requestId
    const result = await new Promise<{
      ok: boolean;
      message: string;
      resolution: number[] | null;
      fps: number | null;
    }>((resolve) => {
      const timeout = setTimeout(() => {
        gateway.streamTestBus.removeAllListeners(requestId);
        resolve({
          ok: false,
          message: 'AI Engine did not respond within 15 seconds. The stream may be unreachable.',
          resolution: null,
          fps: null,
        });
      }, 15_000);

      // One-shot listener on the internal bus — resolved by EventsGateway.handleStreamTestResult()
      gateway.streamTestBus.once(requestId, (data: any) => {
        clearTimeout(timeout);
        resolve({
          ok: data.ok,
          message: data.ok ? 'Connection successful.' : 'Stream verification failed. Check the camera configuration and connectivity.',
          resolution: data.resolution ?? null,
          fps: data.fps ?? null,
        });
      });

      // The probe URL can contain credentials; deliver only to authenticated engines.
      gateway.emitToAiEngines('test_stream', { request_id: requestId, rtsp_url: url });
    });

    return result;
  }
}
