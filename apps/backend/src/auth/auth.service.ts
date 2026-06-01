import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Fix 2: Refresh tokens are now hashed with bcrypt before storage.
 *
 * Why: Plain tokens stored in the DB mean a DB dump leaks every active session.
 * Pattern: Generate a cryptographically random token → return the raw token to
 * the client → store only the bcrypt hash. On lookup, we scan eligible (non-expired)
 * tokens and bcrypt.compare each. Because a user has very few active refresh tokens
 * this small N scan is acceptably cheap.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    const access_token = this.jwtService.sign(payload);
    const refresh_token = await this.createRefreshToken(user.id);
    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(data: any) {
    const user = await this.usersService.create(data);
    return this.login(user);
  }

  /**
   * Google OAuth login/register.
   * - Finds by oauth_provider+oauth_id first (returning user)
   * - Falls back to email match and links the Google account
   * - Creates a brand-new VIEWER account on first-time login
   */
  async loginWithGoogle(profile: {
    googleId: string;
    name: string;
    email: string;
    avatar_url?: string;
  }) {
    // 1. Try to find by Google ID
    let user = await this.prisma.user.findFirst({
      where: { oauth_provider: 'google', oauth_id: profile.googleId },
    });

    // 2. Fall back to email match (link existing account)
    if (!user && profile.email) {
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            oauth_provider: 'google',
            oauth_id: profile.googleId,
            avatar_url: profile.avatar_url ?? user.avatar_url,
          },
        });
      }
    }

    // 3. Create brand-new user
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      user = await this.prisma.user.create({
        data: {
          name: profile.name,
          email: profile.email,
          password: await bcrypt.hash(randomPassword, 10),
          role: Role.VIEWER,
          oauth_provider: 'google',
          oauth_id: profile.googleId,
          avatar_url: profile.avatar_url,
        },
      });
    }

    return this.login(user);
  }

  /**
   * Fix 2: Store a bcrypt hash of the refresh token, not the raw token.
   * Returns the raw token to the client.
   */
  async createRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);

    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRY', '7d');
    const expiresAt = new Date(Date.now() + this.parseExpiry(expiresIn));

    await this.prisma.refreshToken.create({
      data: { token: tokenHash, user_id: userId, expiresAt },
    });

    return rawToken; // only the raw token leaves the server
  }

  /**
   * SEC-4 fix: Scope the refresh token lookup to the owning user.
   *
   * Previous code scanned ALL non-expired tokens across ALL users — a timing-
   * attack vector and O(N users) query. Now we decode the JWT (without
   * signature verification) to extract `sub` (userId), then filter to only
   * that user's tokens. Users typically have 1–3 active sessions, so the
   * bcrypt.compare loop stays trivially cheap.
   */
  async refreshTokens(rawRefreshToken: string) {
    // Decode without verifying to extract the userId claim
    const decoded = this.jwtService.decode(rawRefreshToken) as { sub?: string } | null;
    if (!decoded?.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Scope the query to this specific user (SEC-4)
    const candidates = await this.prisma.refreshToken.findMany({
      where: { user_id: decoded.sub, expiresAt: { gt: new Date() } },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    let match: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      const ok = await bcrypt.compare(rawRefreshToken, candidate.token);
      if (ok) {
        match = candidate;
        break;
      }
    }

    if (!match) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: delete old hash, issue fresh token
    await this.prisma.refreshToken.delete({ where: { id: match.id } });
    return this.login(match.user);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { user_id: userId } });
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findOne(email);
    if (!user) {
      return {
        message:
          'If an account with that email exists, a reset link has been sent.',
      };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { email, token: tokenHash, expiresAt },
    });

    await this.emailService.sendPasswordReset(email, rawToken);

    return {
      message:
        'If an account with that email exists, a reset link has been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: { token: tokenHash, expiresAt: { gt: new Date() } },
    });

    if (!resetToken) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await this.prisma.user.findUnique({
      where: { email: resetToken.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Atomic transaction: update password, revoke all sessions, clean up tokens
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { user_id: user.id },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { email: resetToken.email },
      }),
    ]);

    return { message: 'Password has been reset successfully' };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const val = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return val * (multipliers[unit] || multipliers['d']);
  }
}
