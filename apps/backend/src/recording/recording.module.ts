import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { RecordingService } from './recording.service';
import { RecordingController } from './recording.controller';
import { RecordingScheduler } from './recording.scheduler';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), ConfigModule],
  providers: [RecordingService, RecordingScheduler],
  controllers: [RecordingController],
  exports: [RecordingService],
})
export class RecordingModule {}
