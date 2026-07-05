import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'madad-vision-jwt-secret-2024'),
    });
  }

  async validate(payload: any) {
    // Return a consistent user context — req.user.sub is always defined
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
