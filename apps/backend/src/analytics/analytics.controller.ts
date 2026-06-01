import { Controller, Get, Query, DefaultValuePipe, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get full analytics summary (cached 30s)' })
  getSummary() {
    return this.analyticsService.getSummary();
  }

  @Get('detections')
  @ApiOperation({ summary: 'Detection stats by object type' })
  getDetectionStats() {
    return this.analyticsService.getDetectionStats();
  }

  @Get('hourly')
  @ApiOperation({ summary: 'Hourly detection trend (cached 60s)' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: 'Number of hours to look back (default 24)' })
  getHourlyTrend(@Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number) {
    return this.analyticsService.getHourlyTrend(hours);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Daily detection trend (cached 1h)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default 7)' })
  getDailyTrend(@Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number) {
    return this.analyticsService.getDailyTrend(days);
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Weekly detection trend (cached 1h)' })
  @ApiQuery({ name: 'weeks', required: false, type: Number, description: 'Number of weeks to look back (default 4)' })
  getWeeklyTrend(@Query('weeks', new DefaultValuePipe(4), ParseIntPipe) weeks: number) {
    return this.analyticsService.getWeeklyTrend(weeks);
  }

  @Get('cameras')
  @ApiOperation({ summary: 'Detection activity grouped by camera' })
  getCameraActivity() {
    return this.analyticsService.getCameraActivity();
  }

  @Get('faces')
  @ApiOperation({ summary: 'Face recognition statistics' })
  getFaceRecognitionStats() {
    return this.analyticsService.getFaceRecognitionStats();
  }
}
