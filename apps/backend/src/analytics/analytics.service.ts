import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

const SUMMARY_CACHE_KEY = 'analytics:summary';
const HOURLY_CACHE_KEY = 'analytics:hourly';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async invalidateCache() {
    await this.cache.del(SUMMARY_CACHE_KEY);
    await this.cache.del(HOURLY_CACHE_KEY);
    await this.cache.del('analytics:daily');
    await this.cache.del('analytics:weekly');
    await this.cache.del('analytics:cameras');
    this.logger.debug('Analytics cache invalidated');
  }

  async getSummary() {
    const cached = await this.cache.get(SUMMARY_CACHE_KEY);
    if (cached) return cached;

    const [
      totalDetections,
      byType,
      totalAlerts,
      activeAlerts,
      cameras,
      totalFaceEvents,
      knownFaces,
    ] = await Promise.all([
      this.prisma.detection.count(),
      this.prisma.detection.groupBy({
        by: ['object_type'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.alert.count(),
      this.prisma.alert.count({ where: { status: 'PENDING' } }),
      this.prisma.camera.findMany({ select: { id: true, status: true } }),
      this.prisma.faceEvent.count(),
      this.prisma.faceEvent.count({ where: { NOT: { person_id: null } } }),
    ]);

    const result = {
      totalDetections,
      byType: byType.map((b) => ({ type: b.object_type, count: b._count.id })),
      totalAlerts,
      activeAlerts,
      totalCameras: cameras.length,
      onlineCameras: cameras.filter((c) => c.status === 'ONLINE').length,
      totalFaceEvents,
      knownFaces,
      unknownFaces: totalFaceEvents - knownFaces,
    };

    await this.cache.set(SUMMARY_CACHE_KEY, result, 30000); // 30s TTL
    return result;
  }

  async getDetectionStats() {
    const total = await this.prisma.detection.count();
    const byType = await this.prisma.detection.groupBy({
      by: ['object_type'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    return { total, byType: byType.map((b) => ({ type: b.object_type, count: b._count.id })) };
  }

  async getHourlyTrend(hours = 24) {
    const cached = await this.cache.get(HOURLY_CACHE_KEY);
    if (cached) return cached;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const detections = await this.prisma.detection.findMany({
      where: { timestamp: { gte: since } },
      select: { object_type: true, timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    // Group by hour
    const hourMap = new Map<string, { hour: string; count: number; persons: number; vehicles: number }>();
    for (let h = hours - 1; h >= 0; h--) {
      const d = new Date(Date.now() - h * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
      hourMap.set(key, { hour: key, count: 0, persons: 0, vehicles: 0 });
    }

    for (const d of detections) {
      const dt = new Date(d.timestamp);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:00`;
      const entry = hourMap.get(key);
      if (entry) {
        entry.count++;
        if (d.object_type === 'person') entry.persons++;
        if (['car', 'truck', 'bus', 'motorcycle'].includes(d.object_type)) entry.vehicles++;
      }
    }

    const result = Array.from(hourMap.values());
    await this.cache.set(HOURLY_CACHE_KEY, result, 60000); // 60s TTL
    return result;
  }

  async getDailyTrend(days = 7) {
    const CACHE_KEY = `analytics:daily:${days}`;
    const cached = await this.cache.get(CACHE_KEY);
    if (cached) return cached;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const detections = await this.prisma.detection.findMany({
      where: { timestamp: { gte: since } },
      select: { object_type: true, timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    const dayMap = new Map<string, { day: string; count: number; persons: number; vehicles: number }>();
    for (let d = days - 1; d >= 0; d--) {
      const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dayMap.set(key, { day: key, count: 0, persons: 0, vehicles: 0 });
    }

    for (const d of detections) {
      const dt = new Date(d.timestamp);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const entry = dayMap.get(key);
      if (entry) {
        entry.count++;
        if (d.object_type === 'person') entry.persons++;
        if (['car', 'truck', 'bus', 'motorcycle'].includes(d.object_type)) entry.vehicles++;
      }
    }

    const result = Array.from(dayMap.values());
    await this.cache.set(CACHE_KEY, result, 3600000); // 1h TTL
    return result;
  }

  async getWeeklyTrend(weeks = 4) {
    const CACHE_KEY = `analytics:weekly:${weeks}`;
    const cached = await this.cache.get(CACHE_KEY);
    if (cached) return cached;

    const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
    const detections = await this.prisma.detection.findMany({
      where: { timestamp: { gte: since } },
      select: { object_type: true, timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    const getWeekStart = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(date.setDate(diff)).toISOString().split('T')[0];
    };

    const weekMap = new Map<string, { week: string; count: number; persons: number; vehicles: number }>();
    for (let w = weeks - 1; w >= 0; w--) {
      const date = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000);
      const key = getWeekStart(date);
      if (!weekMap.has(key)) {
         weekMap.set(key, { week: key, count: 0, persons: 0, vehicles: 0 });
      }
    }

    for (const d of detections) {
      const key = getWeekStart(new Date(d.timestamp));
      const entry = weekMap.get(key);
      if (entry) {
        entry.count++;
        if (d.object_type === 'person') entry.persons++;
        if (['car', 'truck', 'bus', 'motorcycle'].includes(d.object_type)) entry.vehicles++;
      }
    }

    const result = Array.from(weekMap.values());
    await this.cache.set(CACHE_KEY, result, 3600000); // 1h TTL
    return result;
  }

  async getCameraActivity() {
    const activity = await this.prisma.detection.groupBy({
      by: ['camera_id'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const cameras = await this.prisma.camera.findMany({
      select: { id: true, name: true, location: true },
    });
    const cameraMap = new Map(cameras.map((c) => [c.id, c]));

    return activity.map((a) => ({
      camera_id: a.camera_id,
      camera_name: cameraMap.get(a.camera_id)?.name ?? a.camera_id,
      location: cameraMap.get(a.camera_id)?.location ?? '',
      detections: a._count.id,
    }));
  }

  async getFaceRecognitionStats() {
    const [totalEvents, knownFaces] = await Promise.all([
      this.prisma.faceEvent.count(),
      this.prisma.faceEvent.count({ where: { NOT: { person_id: null } } }),
    ]);
    return {
      total: totalEvents,
      known: knownFaces,
      unknown: totalEvents - knownFaces,
      recognitionRate: totalEvents > 0 ? Math.round((knownFaces / totalEvents) * 100) : 0,
    };
  }


}
