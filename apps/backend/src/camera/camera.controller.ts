import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { CameraService } from './camera.service';
import { Camera } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { BulkImportCamerasDto } from './dto/bulk-import-cameras.dto';
import { redactRtsp } from '../common/utils/crypto.utils';

@Controller('cameras')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  private redactCameraFields(camera: Camera): Camera {
    return {
      ...camera,
      rtsp_url: redactRtsp(camera.rtsp_url),
      detect_url: camera.detect_url ? redactRtsp(camera.detect_url) : camera.detect_url,
      record_url: camera.record_url ? redactRtsp(camera.record_url) : camera.record_url,
    };
  }

  @Get()
  async findAll(@Req() req: any): Promise<Camera[]> {
    const cameras = await this.cameraService.findAll();
    const user = req.user;
    if (user && user.role === Role.VIEWER) {
      return cameras.map((cam) => this.redactCameraFields(cam));
    }
    return cameras;
  }

  @Get('health')
  async getHealth(@Req() req: any): Promise<Camera[]> {
    const cameras = await this.cameraService.findUnhealthy();
    const user = req.user;
    if (user && user.role === Role.VIEWER) {
      return cameras.map((cam) => this.redactCameraFields(cam));
    }
    return cameras;
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any): Promise<Camera | null> {
    const camera = await this.cameraService.findOne(id);
    if (!camera) return null;
    const user = req.user;
    if (user && user.role === Role.VIEWER) {
      return this.redactCameraFields(camera);
    }
    return camera;
  }

  @Post()
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  create(@Body() data: CreateCameraDto): Promise<Camera> {
    return this.cameraService.create(data);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  update(@Param('id') id: string, @Body() data: UpdateCameraDto): Promise<Camera> {
    return this.cameraService.update(id, data);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string): Promise<Camera> {
    return this.cameraService.remove(id);
  }

  /**
   * Test RTSP reachability via the AI Engine.
   * Emits test_stream to the AI engine over Socket.IO, waits up to 10s
   * for stream_test_result, then returns the result to the HTTP caller.
   */
  @Post(':id/test-connection')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @HttpCode(HttpStatus.OK)
  testConnection(
    @Param('id') id: string,
    @Body('rtsp_url') rtspUrl?: string,
  ): Promise<{ ok: boolean; message: string; resolution: number[] | null; fps: number | null }> {
    return this.cameraService.testConnection(id, rtspUrl);
  }

  @Post('bulk-import')
  @Roles(Role.ADMIN, Role.SECURITY_OPERATOR)
  @HttpCode(HttpStatus.OK)
  bulkImport(@Body() dto: BulkImportCamerasDto): Promise<{ created: number; errors: string[] }> {
    return this.cameraService.bulkImport(dto);
  }
}
