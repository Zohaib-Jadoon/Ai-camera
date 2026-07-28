import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Alert, AlertStatus, Prisma } from '@prisma/client';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  async createAlert(data: {
    event_id: string;
    alert_type: string;
    camera_id?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    zone_id?: string;
  }): Promise<Alert> {
    return this.prisma.alert.create({
      data: {
        event_id: data.event_id,
        alert_type: data.alert_type,
        camera_id: data.camera_id,
        status: AlertStatus.PENDING,
        severity: (data.severity as any) || 'MEDIUM',
        zone_id: data.zone_id,
      },
    });
  }

  async getAlerts(): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      orderBy: { sent_at: 'desc' },
    });
  }

  async updateAlertStatus(id: string, status: string): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: { status: status as AlertStatus },
    });
  }
}
