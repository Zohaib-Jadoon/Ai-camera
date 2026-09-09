import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma/prisma.service';
import { EventsGateway } from './events/events.gateway';
import { PrivacyMaskService } from './privacy-mask/privacy-mask.service';
import { ZoneService } from './zone/zone.service';
import { Logger } from '@nestjs/common';

describe('application dependency wiring', () => {
  it('boots the real module graph with a substituted database and no external connections', async () => {
    const values = {
      NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
      JWT_SECRET: 'test-only-jwt-secret-for-module-wiring', JWT_REFRESH_SECRET: 'test-only-refresh-secret-for-module-wiring',
      AI_ENGINE_KEY: 'test-only-engine-key', CAMERA_ENCRYPTION_KEY: 'a'.repeat(64),
      CAMERA_ENCRYPTION_KEY_ID: 'test', CAMERA_ENCRYPTION_PREVIOUS_KEYS: '{}',
      GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
    };
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    Object.assign(process.env, values);
    const log = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    let app: any;
    try {
      const { AppModule } = await import('./app.module');
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService).useValue({ $connect: jest.fn(), $disconnect: jest.fn() }).compile();
      app = module.createNestApplication({ logger: false });
      await app.init();
      const gateway = app.get(EventsGateway);
      expect((app.get(ZoneService) as any).gateway).toBe(gateway);
      expect((app.get(PrivacyMaskService) as any).gateway).toBe(gateway);
    } finally {
      if (app) await app.close();
      log.mockRestore();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
});
