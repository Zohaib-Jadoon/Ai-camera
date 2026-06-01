import { Controller, Get, Param, Query, ParseIntPipe, DefaultValuePipe, UseGuards, Res, StreamableFile, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { RecordingService } from './recording.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('recordings')
@ApiBearerAuth()
@Controller('recordings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecordingController {
  constructor(private readonly recordingService: RecordingService) {}

  @Get()
  @ApiOperation({ summary: 'List all recordings (newest first)' })
  @ApiQuery({ name: 'trigger', required: false, description: 'Filter by trigger type' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('trigger') trigger?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ) {
    return this.recordingService.findAll(trigger, limit);
  }

  @Get('camera/:cameraId')
  @ApiOperation({ summary: 'List recordings for a specific camera' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findByCamera(
    @Param('cameraId') cameraId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.recordingService.findByCamera(cameraId, limit);
  }

  @Get(':id/download')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Download a recording MP4 file' })
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const recording = await this.recordingService.findById(id);
    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    const filepath = recording.filepath;
    if (!fs.existsSync(filepath)) {
      throw new NotFoundException('Recording file not found');
    }

    const stat = fs.statSync(filepath);
    const filename = path.basename(filepath);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = fs.createReadStream(filepath);
    return new StreamableFile(stream);
  }

  @Get('purge')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Manually trigger retention purge (admin use)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  purge(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days?: number,
  ) {
    return this.recordingService.purgeOldClips(days).then((count) => ({
      message: `Purged ${count} recordings older than ${days} days`,
      count,
    }));
  }
}
