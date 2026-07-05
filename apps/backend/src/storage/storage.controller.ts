import { Controller, Post, Body, Param, UseGuards, Get, Res, BadRequestException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('snapshot/:cameraId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async uploadSnapshot(
    @Param('cameraId') cameraId: string,
    @Body() body: { image: string },
  ) {
    const url = await this.storageService.saveSnapshotBase64(cameraId, body.image);
    return { url };
  }

  @Get('snapshot/:cameraId/:filename')
  serveSnapshot(
    @Param('cameraId') cameraId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Sanitize both cameraId and filename strictly to prevent path traversal
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      cameraId.includes('..') ||
      cameraId.includes('/') ||
      cameraId.includes('\\')
    ) {
      throw new BadRequestException('Invalid path characters');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cameraId)) {
      throw new BadRequestException('Invalid cameraId format');
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      throw new BadRequestException('Invalid filename format');
    }

    const safeCameraId = path.basename(cameraId);
    const safeFilename = path.basename(filename);
    const filepath = path.join(this.storageService.getStoragePath(), safeCameraId, safeFilename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'Snapshot not found' });
    }
    return res.sendFile(path.resolve(filepath));
  }
}
