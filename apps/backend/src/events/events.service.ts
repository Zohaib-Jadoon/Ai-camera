import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Detection, Prisma } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async createDetection(data: {
    camera_id: string;
    object_type: string;
    confidence: number;
    timestamp: string;
    snapshot_url?: string;
    bbox?: any;
  }): Promise<Detection> {
    return this.prisma.detection.create({
      data: {
        camera_id: data.camera_id,
        object_type: data.object_type,
        confidence: data.confidence,
        timestamp: new Date(data.timestamp),
        snapshot_url: data.snapshot_url,
      },
    });
  }

  async getDetections(filters: Prisma.DetectionWhereInput): Promise<Detection[]> {
    return this.prisma.detection.findMany({
      where: filters,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }
}
