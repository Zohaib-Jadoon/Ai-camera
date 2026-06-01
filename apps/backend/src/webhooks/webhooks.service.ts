import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { createHmac } from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWebhookDto) {
    return this.prisma.webhookConfig.create({ data: dto });
  }

  async findAll() {
    return this.prisma.webhookConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const webhook = await this.prisma.webhookConfig.findUnique({
      where: { id },
    });
    if (!webhook) throw new Error('Webhook not found');
    return webhook;
  }

  async update(id: string, dto: UpdateWebhookDto) {
    return this.prisma.webhookConfig.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    return this.prisma.webhookConfig.delete({ where: { id } });
  }

  async dispatch(event: string, payload: any) {
    const webhooks = await this.prisma.webhookConfig.findMany({
      where: { enabled: true, events: { has: event } },
    });

    for (const webhook of webhooks) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(webhook.headers
            ? (webhook.headers as Record<string, string>)
            : {}),
        };

        if (webhook.secret) {
          const signature = createHmac('sha256', webhook.secret)
            .update(JSON.stringify(payload))
            .digest('hex');
          headers['X-Webhook-Signature'] = `sha256=${signature}`;
        }

        const res = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          this.logger.warn(
            `Webhook ${webhook.id} returned ${res.status} for event ${event}`,
          );
        }
      } catch (err: any) {
        this.logger.error(
          `Webhook ${webhook.id} dispatch failed: ${err.message}`,
        );
      }
    }
  }
}
