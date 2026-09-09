import {
  Controller, Get, Post, Delete, Patch,
  Param, Body, ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PrivacyMaskService } from './privacy-mask.service';
import { CreatePrivacyMaskDto, UpdatePrivacyMaskDto } from './dto/privacy-mask.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('privacy-masks')
@ApiBearerAuth()
@Controller('privacy-masks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrivacyMaskController {
  constructor(private readonly privacyMaskService: PrivacyMaskService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Create a privacy mask for a camera' })
  create(@Body() dto: CreatePrivacyMaskDto) {
    return this.privacyMaskService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all privacy masks' })
  findAll() {
    return this.privacyMaskService.findAll();
  }

  @Get('camera/:cameraId')
  @ApiOperation({ summary: 'List privacy masks for a specific camera' })
  findByCamera(@Param('cameraId', ParseUUIDPipe) cameraId: string) {
    return this.privacyMaskService.findByCamera(cameraId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Update a privacy mask (resize/move)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrivacyMaskDto,
  ) {
    return this.privacyMaskService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Delete a privacy mask' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.privacyMaskService.remove(id);
  }
}
