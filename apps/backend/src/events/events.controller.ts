import { Controller, Get, Query, Param, Patch, Body } from '@nestjs/common';
import { EventsService } from './events.service';
import { AlertsService } from './alerts.service';

@Controller('events')
export class EventsController {
  constructor(
    private eventsService: EventsService,
    private alertsService: AlertsService,
  ) {}

  @Get('detections')
  async getDetections(@Query() query: any) {
    return this.eventsService.getDetections(query);
  }

  @Get('alerts')
  async getAlerts() {
    return this.alertsService.getAlerts();
  }

  @Patch('alerts/:id')
  async updateAlertStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.alertsService.updateAlertStatus(id, status);
  }
}
