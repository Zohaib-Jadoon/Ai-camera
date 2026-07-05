import { Controller, Post, Delete, Body, Param, UseGuards, Get, Res, NotFoundException } from '@nestjs/common';
import { StreamingService } from './streaming.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StartStreamDto, TestConnectionDto } from './dto/streaming.dto';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

const HLS_ROOT = process.env.HLS_DIR ?? '/tmp/hls';

@ApiTags('streaming')
@ApiBearerAuth()
@Controller('streaming')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StreamingController {
  constructor(private streamingService: StreamingService) {}

  @Post('start')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Start HLS stream for a camera' })
  startStream(@Body() body: StartStreamDto) {
    return this.streamingService.startHlsStream(body.cameraId, body.rtspUrl);
  }

  @Delete(':cameraId')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Stop HLS stream' })
  stopStream(@Param('cameraId') cameraId: string) {
    this.streamingService.stopHlsStream(cameraId);
    return { message: 'Stream stopped' };
  }

  @Post('test')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @ApiOperation({ summary: 'Test RTSP connection' })
  testConnection(@Body() body: TestConnectionDto) {
    return this.streamingService.testRtspConnection(body.rtspUrl);
  }

  /**
   * Serve HLS playlist and segments.
   * This endpoint is intentionally unguarded — HLS players (video.js, hls.js)
   * cannot send JWT headers on segment requests.
   * Security: segments are short-lived (2s) and the playlist rotates every 10s.
   */
  @Get('hls/:cameraId/:filename')
  serveHls(
    @Param('cameraId') cameraId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Reject path traversal
    if (filename.includes('..') || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      throw new NotFoundException('Invalid filename');
    }

    const filePath = path.join(HLS_ROOT, cameraId, filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Segment not found');
    }

    const contentType = filename.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : 'video/mp2t';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.sendFile(path.resolve(filePath));
  }
}
