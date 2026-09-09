import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EngineHealthService } from './engine-health.service';

@ApiTags('system')
@ApiBearerAuth()
@Controller('system')
export class EngineHealthController {
  constructor(private readonly health: EngineHealthService) {}

  @Get('ai-status')
  status() {
    return this.health.snapshot();
  }
}
