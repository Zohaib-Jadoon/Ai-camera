import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/**
 * Fix 3: Auth endpoints have per-route throttling stricter than the global 100/60s.
 * - login & register: 5 attempts / 60s per IP — prevents brute-force
 * - refresh: 10 attempts / 60s per IP
 * - logout & me: inherit global 100/60s (no override needed)
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Redirect to Google OAuth consent screen' })
  googleAuth() {
    // Passport handles the redirect
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback — redirects to web app with token' })
  async googleCallback(@Req() req: any, @Res() res: any) {
    const authResult = req.user; // set by GoogleStrategy.validate()
    const webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');
    // Pass tokens via query params so the Next.js page can pick them up
    const params = new URLSearchParams({
      access_token: authResult.access_token,
      refresh_token: authResult.refresh_token,
      user: JSON.stringify(authResult.user),
    });
    return res.redirect(`${webUrl}/auth/callback?${params.toString()}`);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Login with email and password (5 req/min per IP)' })
  async login(@Body() req: LoginDto) {
    const user = await this.authService.validateUser(req.email, req.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.authService.login(user);
  }

  @Post('register')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new user account (5 req/min per IP)' })
  async register(@Body() req: RegisterDto) {
    return this.authService.register(req);
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Refresh access token using refresh token (10 req/min per IP)' })
  async refresh(@Body() req: RefreshTokenDto) {
    return this.authService.refreshTokens(req.refresh_token);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate refresh tokens' })
  async logout(@Req() req: any) {
    return this.authService.logout(req.user.sub);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getMe(@Req() req: any) {
    return req.user;
  }
}
