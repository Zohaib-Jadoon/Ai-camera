import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Detection, FaceEvent, Prisma } from '@prisma/client';

@Injectable()
export class AiEventsService {
  constructor(private prisma: PrismaService) {}

  async createDetection(data: Prisma.DetectionUncheckedCreateInput): Promise<Detection> {
    return this.prisma.detection.create({ data });
  }

  async createFaceEvent(data: Prisma.FaceEventUncheckedCreateInput): Promise<FaceEvent> {
    return this.prisma.faceEvent.create({ data });
  }

  async getRecentDetections(limit = 50): Promise<Detection[]> {
    return this.prisma.detection.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: { camera: true },
    });
  }
}
