import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EventsGateway } from './events.gateway';
import { EngineHealthService } from './engine-health.service';
import { EngineHealthController } from './engine-health.controller';
import { AiEventsModule } from '../ai-events/ai-events.module';
import { AlertsModule } from '../alerts/alerts.module';
import { CameraModule } from '../camera/camera.module';
import { FacesModule } from '../faces/faces.module';
import { RecordingModule } from '../recording/recording.module';

@Module({
  imports: [
    AiEventsModule,
    AlertsModule,
    JwtModule,
    ConfigModule,
    forwardRef(() => CameraModule),
    FacesModule,
    RecordingModule,   // 🐦 Frigate: provides RecordingService for start_recording handler
  ],
  providers: [EventsGateway, EngineHealthService],
  controllers: [EngineHealthController],
  exports: [EventsGateway],
})
export class EventsModule {}
