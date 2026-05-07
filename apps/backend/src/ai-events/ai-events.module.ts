import { Module } from '@nestjs/common';
import { AiEventsService } from './ai-events.service';

@Module({
  providers: [AiEventsService],
  exports: [AiEventsService],
})
export class AiEventsModule {}
