import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './auth/public.decorator';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Health check endpoint for Docker / K8s readiness probes and uptime monitors.
   * Accessible at GET /api/health — no auth required (@Public).
   */
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check — returns ok if the server is running' })
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'madad-vision-backend',
      version: process.env.npm_package_version ?? '1.0.0',
    };
  }
}
