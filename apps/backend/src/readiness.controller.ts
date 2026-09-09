import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class ReadinessController {
  constructor(private readonly prisma: PrismaService) {}
  @Public()
  @Get('ready')
  async ready() {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([
          this.prisma.$queryRaw`SELECT "status", "sha256" FROM "Recording" LIMIT 0`,
          this.prisma.$queryRaw`SELECT "review_status" FROM "Alert" LIMIT 0`,
        ]),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error()), 2000); }),
      ]);
      return { status: 'ready' };
    } catch { throw new ServiceUnavailableException('Not ready'); }
    finally { if (timeout) clearTimeout(timeout); }
  }
}
