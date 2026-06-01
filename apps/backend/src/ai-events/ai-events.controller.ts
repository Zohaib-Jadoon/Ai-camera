import { Controller, Get, Query, DefaultValuePipe, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AiEventsService } from './ai-events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('ai-events')
@ApiBearerAuth()
@Controller('events')
@UseGuards(JwtAuthGuard)
export class AiEventsController {
  constructor(private readonly aiEventsService: AiEventsService) {}

  @Get('detections')
  @ApiOperation({ summary: 'Get recent detections' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecentDetections(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return this.aiEventsService.getRecentDetections(limit);
  }

  @Get('faces')
  @ApiOperation({ summary: 'Get recent face events' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecentFaceEvents(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return this.aiEventsService.getRecentFaceEvents(limit);
  }
}
