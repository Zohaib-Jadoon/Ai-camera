import { Module } from '@nestjs/common';
import { AiEventsService } from './ai-events.service';
import { AiEventsController } from './ai-events.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiEventsController],
  providers: [AiEventsService],
  exports: [AiEventsService],
})
export class AiEventsModule {}
