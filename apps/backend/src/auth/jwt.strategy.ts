import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * JWT Strategy — validates access tokens from the Authorization header.
 *
 * The validated payload is attached to `req.user` and uses consistent
 * field names:
 *   - req.user.sub   → user ID (UUID)
 *   - req.user.email → user email
 *   - req.user.role  → user role (ADMIN | SECURITY_OPERATOR | VIEWER)
 *
 * NOTE: Previously this returned `{ userId: payload.sub }` which caused
 * a silent undefined bug in AuthController.logout (used req.user.sub).
 * Now `sub` is always present on req.user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new UnauthorizedException('Invalid session');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user?.isActive) throw new UnauthorizedException('Invalid session');
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
