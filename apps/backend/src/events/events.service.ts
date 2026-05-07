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
        cameraId: data.camera_id,
        objectType: data.object_type,
        confidence: data.confidence,
        timestamp: new Date(data.timestamp),
        snapshotUrl: data.snapshot_url,
        bbox: data.bbox,
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
