import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CameraGroupsService } from './camera-groups.service';
import { CreateCameraGroupDto } from './dto/create-camera-group.dto';
import { UpdateCameraGroupDto } from './dto/update-camera-group.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('camera-groups')
@ApiBearerAuth()
@Controller('camera-groups')
@UseGuards(JwtAuthGuard)
export class CameraGroupsController {
  constructor(private readonly cameraGroupsService: CameraGroupsService) {}

  @Get()
  findAll() {
    return this.cameraGroupsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cameraGroupsService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCameraGroupDto) {
    return this.cameraGroupsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCameraGroupDto) {
    return this.cameraGroupsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.cameraGroupsService.remove(id);
  }
}
