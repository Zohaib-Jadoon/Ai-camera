import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CameraService } from './camera.service';
import { Camera, Prisma } from '@prisma/client';

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
  create(@Body() data: Prisma.CameraCreateInput): Promise<Camera> {
    return this.cameraService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Prisma.CameraUpdateInput): Promise<Camera> {
    return this.cameraService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<Camera> {
    return this.cameraService.remove(id);
  }
}
