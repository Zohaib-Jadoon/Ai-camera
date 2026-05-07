import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CameraModule } from './camera/camera.module';
import { AuthModule } from './auth/auth.module';
import { EventsGateway } from './events/events.gateway';
import { Camera } from './camera/camera.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'user',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'madad_vision',
      entities: [Camera],
      synchronize: true, // Don't use in production
    }),
    CameraModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, EventsGateway],
})
export class AppModule {}
