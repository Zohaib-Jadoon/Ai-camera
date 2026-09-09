import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('controlled onboarding', () => {
  it('blocks public registration before any account is created by default', async () => {
    const users = { create: jest.fn() };
    const service = new AuthService(users as any, {} as any, new ConfigService({ ALLOW_SELF_REGISTRATION: 'false' }), {} as any, {} as any);
    await expect(service.register({ email: 'test@example.invalid' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.create).not.toHaveBeenCalled();
  });
  it('applies the same policy to first-time OAuth accounts', async () => {
    const db = { user: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() } };
    const service = new AuthService({} as any, {} as any, new ConfigService({ ALLOW_SELF_REGISTRATION: 'false' }), db as any, {} as any);
    await expect(service.loginWithGoogle({ googleId: 'test', name: 'Test', email: 'test@example.invalid' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.user.create).not.toHaveBeenCalled();
  });
});
