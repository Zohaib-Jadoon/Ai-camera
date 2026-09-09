import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('session security', () => {
  const user = {
    id: 'test-user',
    name: 'Operator',
    email: 'operator@example.invalid',
    role: 'VIEWER',
    isActive: true,
  };
  let db: any;
  let auth: AuthService;
  const jwt = new JwtService({
    secret: 'unit-test-only-secret-with-no-real-access',
    signOptions: { expiresIn: '15m' },
  });

  beforeEach(() => {
    db = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((callback) => callback(db)),
    };
    auth = new AuthService({} as any, jwt, new ConfigService(), db, {} as any);
  });

  it('issues opaque tokens and stores only their complete digest', async () => {
    const token = await auth.createRefreshToken(user.id);
    expect(token).toMatch(/^[a-f0-9]{80}$/);
    expect(db.refreshToken.create).toHaveBeenCalledWith({
      data: {
        token: createHash('sha256').update(token).digest('hex'),
        user_id: user.id,
        expiresAt: expect.any(Date),
      },
    });
  });

  it('refreshes a valid token and returns a new pair using current user data', async () => {
    const token = 'a'.repeat(80);
    db.refreshToken.findUnique.mockResolvedValue({
      id: 'session',
      user,
      expiresAt: new Date(Date.now() + 60000),
    });
    db.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    const result = await auth.refreshTokens(token);
    expect(jwt.verify(result.access_token).sub).toBe(user.id);
    expect(result.refresh_token).not.toBe(token);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a token already consumed by another request', async () => {
    db.refreshToken.findUnique.mockResolvedValue({
      id: 'session',
      user,
      expiresAt: new Date(Date.now() + 60000),
    });
    db.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    await expect(auth.refreshTokens('a'.repeat(80))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.refreshToken.create).not.toHaveBeenCalled();
  });

  it.each(['', 'jwt.with.dots', 'a'.repeat(79), 'g'.repeat(80)])(
    'rejects malformed refresh tokens before querying: %s',
    async (token) => {
      await expect(auth.refreshTokens(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['missing', 'expired', 'inactive'])(
    'rejects %s refresh sessions',
    async (state) => {
      db.refreshToken.findUnique.mockResolvedValue(
        state === 'missing'
          ? null
          : {
              id: 'session',
              user: { ...user, isActive: state !== 'inactive' },
              expiresAt: new Date(
                Date.now() + (state === 'expired' ? -1000 : 60000),
              ),
            },
      );
      await expect(auth.refreshTokens('a'.repeat(80))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(db.refreshToken.create).not.toHaveBeenCalled();
    },
  );

  it('does not issue a session for inactive accounts, including OAuth login', async () => {
    await expect(
      auth.login({ ...user, isActive: false }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.refreshToken.create).not.toHaveBeenCalled();
  });

  it('loads current role rather than trusting stale JWT role claims', async () => {
    db.user.findUnique.mockResolvedValue(user);
    const strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: 'unit-test-secret' }),
      db,
    );
    expect(await strategy.validate({ sub: user.id, role: 'ADMIN' })).toEqual({
      sub: user.id,
      role: 'VIEWER',
      email: user.email,
    });
  });

  it('rejects deactivated accounts even when the access token is unexpired', async () => {
    db.user.findUnique.mockResolvedValue({ ...user, isActive: false });
    const strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: 'unit-test-secret' }),
      db,
    );
    await expect(strategy.validate({ sub: user.id })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
