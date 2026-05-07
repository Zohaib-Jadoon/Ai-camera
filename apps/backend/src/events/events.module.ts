import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';
import { AlertsService } from './alerts.service';
import { EventsController } from './events.controller';

@Module({
  providers: [EventsGateway, EventsService, AlertsService],
  controllers: [EventsController],
  exports: [EventsService, AlertsService],
})
export class EventsModule {}
