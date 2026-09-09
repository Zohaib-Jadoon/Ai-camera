import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Zone } from '@prisma/client';
import { IBroadcastGateway, EventsGateway } from '../events/events.gateway';

@Injectable()
export class ZoneService {
  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(forwardRef(() => EventsGateway)) private gateway?: IBroadcastGateway,
  ) {}

  async findAll(): Promise<Zone[]> {
    return this.prisma.zone.findMany({ include: { camera: { select: { id: true, name: true, location: true, status: true } } } });
  }

  async findOne(id: string): Promise<Zone | null> {
    return this.prisma.zone.findUnique({ where: { id }, include: { camera: { select: { id: true, name: true, location: true, status: true } } } });
  }

  async create(data: { camera_id: string; polygon_points: any; rule_type: string; name?: string }): Promise<Zone> {
    const zone = await this.prisma.zone.create({
      data: {
        camera_id: data.camera_id,
        polygon_points: data.polygon_points,
        rule_type: data.rule_type,
        ...(data.name ? { name: data.name } : {}),
      },
    });
    this.gateway?.broadcastZoneSync(data.camera_id).catch(() => {});
    return zone;
  }

  async update(id: string, data: { camera_id?: string; polygon_points?: any; rule_type?: string; name?: string }): Promise<Zone> {
    const zone = await this.prisma.zone.update({ where: { id }, data });
    this.gateway?.broadcastZoneSync(zone.camera_id).catch(() => {});
    return zone;
  }

  async remove(id: string): Promise<Zone> {
    const zone = await this.prisma.zone.delete({ where: { id } });
    this.gateway?.broadcastZoneSync(zone.camera_id).catch(() => {});
    return zone;
  }
}
