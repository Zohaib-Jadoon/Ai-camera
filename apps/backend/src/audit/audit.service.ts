import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  user_id?: string;
  action: string;
  resource: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: entry.user_id,
          action: entry.action,
          resource: entry.resource,
          resource_id: entry.resource_id,
          details: entry.details ?? undefined,
          ip_address: entry.ip_address,
        },
      });
    } catch {
      // Silently fail audit logging to avoid breaking business logic
    }
  }
}
