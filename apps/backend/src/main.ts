import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);

  // Security headers — hardened CSP, HSTS, referrer policy (SEC-1)
  const isProduction = configService.get('NODE_ENV') === 'production';
  app.use(
    helmet.default({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          // Allow WebSocket connections to the backend itself
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        } as any,
      },
      hsts: isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Prevent MIME-type sniffing (SEC: MIME sniffing)
      noSniff: true,
      // Prevent clickjacking
      frameguard: { action: 'deny' },
      // Remove X-Powered-By (information disclosure)
      hidePoweredBy: true,
    }),
  );

  // Raise body-parser limits so face photo uploads (base64 ≈ 3–10 MB) don't fail.
  // Default NestJS/Express limit is 100 KB which truncates any image payload.
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  // Response compression for JSON payloads (analytics, embeddings, etc.)
  app.use(compression());


  // CORS
  // NOTE: credentials:true + origin:'*' is rejected by browsers.
  // When CORS_ORIGIN is '*' we reflect the request origin so credentials work.
  const corsOrigin = configService.get<string>('CORS_ORIGIN', '*');
  const allowedOrigins = corsOrigin === '*' ? null : corsOrigin.split(',').map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins
      ? allowedOrigins
      : (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          callback(null, true); // reflect all origins in dev (no explicit list)
        },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Bug 3 fix: GlobalExceptionFilter is now registered via APP_FILTER in AppModule (DI-aware).
  // DO NOT add app.useGlobalFilters() here — it would create a second, non-DI instance.

  // API prefix
  app.setGlobalPrefix('api');

  // Graceful shutdown
  app.enableShutdownHooks();

  // Swagger (dev only)
  if (configService.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Madad Vision AI API')
      .setDescription('REST API for Madad Vision AI surveillance platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`Swagger docs at: http://localhost:3001/api/docs`);
  }

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  logger.log(`Madad Vision AI Backend running on port ${port}`);
}

bootstrap();
