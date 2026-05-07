import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const totalDetections = await this.prisma.detection.count();
    const activeAlerts = await this.prisma.alert.count({ where: { status: 'NEW' } });
    const camerasOnline = await this.prisma.camera.count({ where: { status: 'ONLINE' } });
    const intrusionEvents = await this.prisma.alert.count({ where: { alertType: 'INTRUSION' } });

    // Last 24 hours trend (mocked for simplicity)
    const detectionTrends = [
      { timestamp: '00:00', count: 12 },
      { timestamp: '04:00', count: 5 },
      { timestamp: '08:00', count: 45 },
      { timestamp: '12:00', count: 60 },
      { timestamp: '16:00', count: 30 },
      { timestamp: '20:00', count: 15 },
    ];

    return {
      totalDetections,
      activeAlerts,
      camerasOnline,
      intrusionEvents,
      detectionTrends,
    };
  }
}
