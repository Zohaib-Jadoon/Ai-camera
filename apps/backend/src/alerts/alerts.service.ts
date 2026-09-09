import { BadRequestException, ConflictException, Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AlertSeverity } from '@prisma/client';
import { WebhooksService } from '../webhooks/webhooks.service';

type AlertStatusType = 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';

const ACTIVE_COUNT_KEY = 'alerts:active_count';
/** Hard cap on alert list queries — prevents OOM on large tables */
const MAX_LIMIT = 500;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  /** Default cooldown between identical alerts: 60 seconds */
  private readonly COOLDOWN_MS = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly webhooksService: WebhooksService,
  ) {}

  async findAll(status?: string, assigneeId?: string, limit = 100) {
    const where: any = {};
    if (status) where.status = status as AlertStatusType;
    if (assigneeId) where.assignee_id = assigneeId;

    return this.prisma.alert.findMany({
      where,
      orderBy: { sent_at: 'desc' },
      take: Math.min(limit, MAX_LIMIT),
    });
  }

  private calculateSeverity(
    objectType: string,
    ruleType?: string,
  ): AlertSeverity {
    const type = objectType.toLowerCase();

    if (['knife', 'scissors', 'gun', 'weapon'].includes(type)) {
      return AlertSeverity.CRITICAL;
    }

    if (type === 'person') {
      const rt = ruleType?.toLowerCase();
      if (rt === 'intrusion') return AlertSeverity.HIGH;
      if (rt === 'loitering') return AlertSeverity.MEDIUM;
      return AlertSeverity.MEDIUM;
    }

    if (['car', 'truck', 'bus'].includes(type)) {
      return AlertSeverity.LOW;
    }

    return AlertSeverity.MEDIUM;
  }

  async create(data: {
    event_id: string;
    alert_type: string;
    camera_id?: string;
    zone_id?: string;
    object_type?: string;
    rule_type?: string;
    severity?: AlertSeverity;
  }) {
    let severity: AlertSeverity;

    if (data.object_type) {
      severity = this.calculateSeverity(data.object_type, data.rule_type);
    } else {
      const type = data.alert_type.toUpperCase();
      if (
        type.includes('INTRUSION') ||
        type.includes('FIRE') ||
        type.includes('SMOKE') ||
        type.includes('FALL') ||
        type.includes('FIGHT') ||
        type.includes('WEAPON')
      )
        severity = AlertSeverity.CRITICAL;
      else if (
        type.includes('UNKNOWN_FACE') ||
        type.includes('PPE_VIOLATION') ||
        type.includes('WRONG_WAY') ||
        type.includes('SPEED_VIOLATION')
      )
        severity = AlertSeverity.HIGH;
      else if (type.includes('CONGESTION'))
        severity = type.includes('CRITICAL')
          ? AlertSeverity.HIGH
          : AlertSeverity.MEDIUM;
      else if (type.includes('KNOWN_FACE')) severity = AlertSeverity.LOW;
      else severity = AlertSeverity.MEDIUM;
    }

    // ── Cooldown / deduplication (Redis-backed, survives restarts) ─────────
    const cooldownKey = `alert:cooldown:${data.camera_id || 'global'}:${data.alert_type}`;
    const cached = await this.cache.get(cooldownKey);
    if (cached) {
      this.logger.debug(`Alert cooldown active for ${cooldownKey} — skipping`);
      return null;
    }
    await this.cache.set(cooldownKey, true, this.COOLDOWN_MS);

    let alertData: typeof data & { severity: AlertSeverity } = {
      ...data,
      severity,
    };
    const { object_type, rule_type, ...validAlertData } = alertData as any;
    try {
      const alert = await this.prisma.alert.create({ data: validAlertData });
      await this.cache.del(ACTIVE_COUNT_KEY);
      await this.cache.del('analytics:summary');
      await this.cache.del('analytics:hourly');
      await this.cache.del('analytics:daily');
      await this.cache.del('analytics:weekly');
      await this.cache.del('analytics:cameras');
      this.logger.log(`Alert created [${alert.alert_type}] id=${alert.id}`);

      // Unreviewed machine alerts stay in the operator dashboard. External
      // consequential integrations receive only explicit human confirmations.

      return alert;
    } catch (err: any) {
      await this.cache.del(cooldownKey).catch(() => {});
      if (alertData.zone_id && err?.code === 'P2003') {
        // Foreign-key violation — retry without zone_id
        this.logger.warn(
          `zone_id=${alertData.zone_id} not found in Zone table — creating alert without zone reference`,
        );
        const { zone_id: _removed, ...withoutZone } = alertData;
        const alert = await this.prisma.alert.create({ data: withoutZone });
        await this.cache.del(ACTIVE_COUNT_KEY);
        await this.cache.del('analytics:summary');
        await this.cache.del('analytics:hourly');
        await this.cache.del('analytics:daily');
        await this.cache.del('analytics:weekly');
        await this.cache.del('analytics:cameras');
        return alert;
      }
      throw err;
    }
  }

  async createFromDetection(detection: {
    id: string;
    camera_id: string;
    object_type: string;
  }) {
    return this.create({
      event_id: detection.id,
      alert_type: `DETECTION_${detection.object_type.toUpperCase()}`,
      camera_id: detection.camera_id,
      object_type: detection.object_type,
    });
  }

  async assign(id: string, assigneeId: string) {
    return this.prisma.alert.update({
      where: { id },
      data: { assignee_id: assigneeId },
    });
  }

  async updateStatus(id: string, status: AlertStatusType) {
    if (status === 'RESOLVED') {
      const existing = await this.prisma.alert.findUniqueOrThrow({ where: { id } });
      if (existing.review_status === 'PENDING') throw new BadRequestException('Human review is required before resolution');
    }
    const validStatuses: AlertStatusType[] = [
      'PENDING',
      'ACKNOWLEDGED',
      'RESOLVED',
    ];
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`,
      );
    }
    const alert = await this.prisma.alert.update({
      where: { id },
      data: { status },
    });
    await this.cache.del(ACTIVE_COUNT_KEY);
    await this.cache.del('analytics:summary');
    return alert;
  }

  async getActiveCount(): Promise<number> {
    const cached = await this.cache.get<number>(ACTIVE_COUNT_KEY);
    if (cached !== undefined && cached !== null) return cached;

    const count = await this.prisma.alert.count({
      where: { status: 'PENDING' },
    });
    await this.cache.set(ACTIVE_COUNT_KEY, count, 10000);
    return count;
  }

  async review(id: string, verdict: 'CONFIRMED' | 'DISMISSED', note: string, reviewer: string) {
    if (!['CONFIRMED', 'DISMISSED'].includes(verdict) || !reviewer || note.trim().length < 3) {
      throw new BadRequestException('A reviewer, verdict and explanation are required');
    }
    const result = await this.prisma.alert.updateMany({ where: { id, review_status: 'PENDING' }, data: {
      review_status: verdict, reviewed_by: reviewer, reviewed_at: new Date(), review_note: note.trim(),
    } });
    if (result.count !== 1) throw new ConflictException('Alert was already reviewed or does not exist');
    const alert = await this.prisma.alert.findUniqueOrThrow({ where: { id } });
    if (verdict === 'CONFIRMED') {
      await this.webhooksService.dispatch('alert.reviewed', {
        id, alert_type: alert.alert_type, severity: alert.severity,
        camera_id: alert.camera_id, review_status: verdict, reviewed_by: reviewer,
      }).catch(() => this.logger.warn('Review saved; external delivery failed'));
    }
    return alert;
  }
}
