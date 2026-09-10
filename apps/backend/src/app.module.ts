import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { ReadinessController } from './readiness.controller';
import { AppService } from './app.service';
import { CameraModule } from './camera/camera.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AiEventsModule } from './ai-events/ai-events.module';
import { AlertsModule } from './alerts/alerts.module';
import { FacesModule } from './faces/faces.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { StreamingModule } from './streaming/streaming.module';
import { ZoneModule } from './zone/zone.module';
import { EventsModule } from './events/events.module';
import { StorageModule } from './storage/storage.module';
import { RecordingModule } from './recording/recording.module';
import { PrivacyMaskModule } from './privacy-mask/privacy-mask.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { SettingsModule } from './settings/settings.module';
import { EmailModule } from './email/email.module';
import { EvidenceModule } from './evidence/evidence.module';
import { AlertRulesModule } from './alert-rules/alert-rules.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { EscalationModule } from './escalation/escalation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CameraGroupsModule } from './camera-groups/camera-groups.module';
import { TrainingModule } from './training/training.module';
import { RolesGuard } from './auth/roles.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import * as Joi from 'joi';

@Module({
  imports: [
    // Fix 1: Joi schema validates all required env vars at bootstrap.
    // The process exits immediately with a descriptive error if anything is missing,
    // instead of crashing silently on the first DB or JWT call.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/backend/.env', '.env.local'],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri().required(),
        JWT_SECRET: Joi.string().min(16).required(),
        JWT_REFRESH_SECRET: Joi.string().min(16).required(),
        AI_ENGINE_KEY: Joi.string().min(8).required(),
        CAMERA_ENCRYPTION_KEY: Joi.string().pattern(/^[a-fA-F0-9]{64}$/).required(),
        CAMERA_ENCRYPTION_KEY_ID: Joi.string().pattern(/^[a-zA-Z0-9_-]{1,40}$/).default('primary'),
        ALLOW_LEGACY_CAMERA_CREDENTIALS: Joi.string().valid('true', 'false').default('true'),
        ALLOW_SELF_REGISTRATION: Joi.string().valid('true', 'false').default('false'),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        PORT: Joi.number().default(3001),
        CORS_ORIGIN: Joi.string().default('*'),
        CACHE_TTL: Joi.number().default(30),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
      }),
      validationOptions: { abortEarly: false },
    }),

    // In-process cache (no external dependency in dev; swap to redis store in prod)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (config: ConfigService) => ({
        ttl: config.get<number>('CACHE_TTL', 30) * 1000,
        max: 1000,
      }),
      inject: [ConfigService],
    }),

    // Rate limiting — 100 req / 60s per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    PrismaModule,
    UsersModule,
    CameraModule,
    ZoneModule,
    AuthModule,
    AiEventsModule,
    AlertsModule,
    FacesModule,
    AnalyticsModule,
    StreamingModule,
    EventsModule,
    StorageModule,
    RecordingModule,
    PrivacyMaskModule,
    AuditModule,
    SettingsModule,
    EmailModule,
    EvidenceModule,
    AlertRulesModule,
    WebhooksModule,
    EscalationModule,
    NotificationsModule,
    CameraGroupsModule,
    TrainingModule,
  ],
  controllers: [AppController, ReadinessController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
