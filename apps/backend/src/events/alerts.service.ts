import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  async createAlert(data: any) {
    return this.prisma.alert.create({
      data: {
        eventId: data.event_id,
        alertType: data.alert_type,
        cameraId: data.camera_id,
        confidence: data.confidence,
        snapshotUrl: data.snapshot_url,
        status: 'NEW',
      },
    });
  }

  async getAlerts() {
    return this.prisma.alert.findMany({
      orderBy: { timestamp: 'desc' },
    });
  }

  async updateAlertStatus(id: string, status: string) {
    return this.prisma.alert.update({
      where: { id },
      data: { status },
    });
  }
}
