import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: "Get current user's settings" })
  findOne(@Req() req: any) {
    return this.settingsService.findByUserId(req.user.sub);
  }

  @Patch()
  @ApiOperation({ summary: "Update current user's settings" })
  update(@Req() req: any, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(req.user.sub, dto);
  }
}
