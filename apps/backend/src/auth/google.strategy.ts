import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private static readonly log = new Logger('GoogleStrategy');

  constructor(
    config: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') || 'DISABLED';
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') || 'DISABLED';
    const callbackURL = config.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3001/api/auth/google/callback',
    );

    // passport-google-oauth20 will throw if clientID is empty-string; using the
    // sentinel 'DISABLED' prevents the crash while the strategy is registered
    // but inactive. The controller guards handle the rest.
    super({ clientID, clientSecret, callbackURL, scope: ['email', 'profile'] });

    if (clientID === 'DISABLED') {
      GoogleStrategy.log.warn(
        'GOOGLE_CLIENT_ID not set — Google OAuth is disabled. ' +
          'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable it.',
      );
    }
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, displayName, emails, photos } = profile;
    const email = emails?.[0]?.value;
    const avatar_url = photos?.[0]?.value;

    try {
      const authResult = await this.authService.loginWithGoogle({
        googleId: id,
        name: displayName,
        email,
        avatar_url,
      });
      done(null, authResult);
    } catch (err) {
      done(err as Error, false);
    }
  }
}
