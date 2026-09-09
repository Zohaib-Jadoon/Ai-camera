import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { EvidenceService } from './evidence.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { createHash } from 'crypto';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get(':id/export')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  async exportAlertPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.evidenceService.exportAlertPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="evidence-${id}.pdf"`,
      'Content-Length': buffer.length,
      'Content-Digest': `sha-256=:${createHash('sha256').update(buffer).digest('base64')}:`,
      'Cache-Control': 'no-store',
    });
    res.send(buffer);
  }
}
