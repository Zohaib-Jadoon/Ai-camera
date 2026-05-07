import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CameraModule } from './camera/camera.module';
import { AuthModule } from './auth/auth.module';
import { EventsGateway } from './events/events.gateway';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AiEventsModule } from './ai-events/ai-events.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    CameraModule,
    AuthModule,
    AiEventsModule,
  ],
  controllers: [AppController],
  providers: [AppService, EventsGateway],
})
export class AppModule {}
