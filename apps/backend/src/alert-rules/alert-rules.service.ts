import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';

@Injectable()
export class AlertRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAlertRuleDto) {
    const { schedules, ...data } = dto;
    return this.prisma.alertRule.create({
      data: {
        ...data,
        schedules: schedules ? { create: schedules } : undefined,
      },
      include: { schedules: true, camera: { select: { id: true, name: true, location: true, status: true } } },
    });
  }

  async findAll(cameraId?: string, enabled?: boolean) {
    const where: any = {};
    if (cameraId !== undefined) where.camera_id = cameraId;
    if (enabled !== undefined) where.enabled = enabled;
    return this.prisma.alertRule.findMany({
      where,
      include: { schedules: true, camera: { select: { id: true, name: true, location: true, status: true } } },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.alertRule.findUnique({
      where: { id },
      include: { schedules: true, camera: { select: { id: true, name: true, location: true, status: true } } },
    });
    if (!rule) throw new NotFoundException('Alert rule not found');
    return rule;
  }

  async update(id: string, dto: UpdateAlertRuleDto) {
    const { schedules, ...data } = dto;
    return this.prisma.alertRule.update({
      where: { id },
      data: {
        ...data,
        schedules: schedules
          ? { deleteMany: {}, create: schedules }
          : undefined,
      },
      include: { schedules: true, camera: { select: { id: true, name: true, location: true, status: true } } },
    });
  }

  async remove(id: string) {
    return this.prisma.alertRule.delete({ where: { id } });
  }

  async evaluateRules(event: {
    camera_id: string;
    object_type: string;
    alert_type: string;
    severity: string;
    timestamp: Date | string;
  }) {
    const rules = await this.prisma.alertRule.findMany({
      where: { enabled: true },
      include: { schedules: true },
    });

    const now = event.timestamp ? new Date(event.timestamp) : new Date();
    const dayOfWeek = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();

    const matches = rules.filter((rule) => {
      if (rule.camera_id && rule.camera_id !== event.camera_id) return false;
      if (rule.object_type && rule.object_type !== event.object_type)
        return false;
      if (rule.alert_type !== event.alert_type) return false;

      if (rule.schedule_mode === 'SCHEDULED') {
        if (!rule.schedules || rule.schedules.length === 0) return false;
        const inWindow = rule.schedules.some((s) => {
          if (s.day_of_week !== dayOfWeek) return false;
          const start = this.timeToMinutes(s.start_time);
          const end = this.timeToMinutes(s.end_time);
          return minutes >= start && minutes <= end;
        });
        if (!inWindow) return false;
      }
      return true;
    });

    return matches.length > 0 ? matches : null;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
