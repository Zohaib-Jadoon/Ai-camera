import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSettingsDto } from './dto/update-settings.dto';

describe('Settings HTTP DTO contract', () => {
  const check = (body: object) => validate(plainToInstance(UpdateSettingsDto, body), { whitelist: true, forbidNonWhitelisted: true });
  it('accepts normalized thresholds and false notification preferences', async () => {
    expect(await check({ confidence_threshold: 0.8, ai_enabled: true, notification_email: false, notification_push: true, notification_sms: false })).toEqual([]);
  });
  it('rejects percentages and UI-only fields', async () => {
    expect((await check({ confidence_threshold: 80 })).length).toBeGreaterThan(0);
    expect((await check({ confidenceThreshold: 80, id: 'metadata' })).length).toBeGreaterThan(0);
  });
});
