import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() req: any) {
    // In a real app, validate user credentials here
    return this.authService.login({ email: req.email, userId: '1', role: 'ADMIN' });
  }
}
