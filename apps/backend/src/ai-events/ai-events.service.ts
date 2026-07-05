import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Detection, FaceEvent, Prisma } from '@prisma/client';

@Injectable()
export class AiEventsService {
  private readonly logger = new Logger(AiEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createDetection(data: Prisma.DetectionUncheckedCreateInput): Promise<Detection> {
    const detection = await this.prisma.detection.create({ data });
    this.logger.debug(`Detection created: ${data.object_type} (${data.camera_id})`);
    return detection;
  }

  async createFaceEvent(data: Prisma.FaceEventUncheckedCreateInput): Promise<FaceEvent> {
    const event = await this.prisma.faceEvent.create({ data });
    this.logger.debug(`Face event created: person_id=${data.person_id ?? 'unknown'} (${data.camera_id})`);
    return event;
  }

  async getRecentDetections(limit = 50) {
    return this.prisma.detection.findMany({
      take: Math.min(limit, 500),
      orderBy: { timestamp: 'desc' },
      include: { camera: { select: { name: true, location: true } } },
    });
  }

  async getRecentFaceEvents(limit = 50) {
    return this.prisma.faceEvent.findMany({
      take: Math.min(limit, 200),
      orderBy: { timestamp: 'desc' },
      include: {
        person: { select: { name: true, tag: true } },
        camera: { select: { name: true } },
      },
    });
  }
}
