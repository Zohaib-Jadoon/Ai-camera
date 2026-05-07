import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { CameraService } from './camera.service';
import { Camera } from '@prisma/client';

@Controller('cameras')
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  @Get()
  findAll(): Promise<Camera[]> {
    return this.cameraService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Camera | null> {
    return this.cameraService.findOne(id);
  }

  @Post()
  create(@Body() camera: any): Promise<Camera> {
    return this.cameraService.create(camera);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() camera: any): Promise<Camera | null> {
    return this.cameraService.update(id, camera);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.cameraService.remove(id);
  }
}
