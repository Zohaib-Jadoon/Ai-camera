import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCameraGroupDto } from './dto/create-camera-group.dto';
import { UpdateCameraGroupDto } from './dto/update-camera-group.dto';

@Injectable()
export class CameraGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCameraGroupDto) {
    const { cameraIds, ...data } = dto;
    const group = await this.prisma.cameraGroup.create({ data });
    if (cameraIds && cameraIds.length > 0) {
      await this.prisma.camera.updateMany({
        where: { id: { in: cameraIds } },
        data: { group_id: group.id },
      });
    }
    return this.findOne(group.id);
  }

  async findAll() {
    return this.prisma.cameraGroup.findMany({
      include: { cameras: { select: { id: true, name: true, status: true } } },
    });
  }

  async findOne(id: string) {
    const group = await this.prisma.cameraGroup.findUnique({
      where: { id },
      include: { cameras: { select: { id: true, name: true, status: true } } },
    });
    if (!group) throw new NotFoundException('Camera group not found');
    return group;
  }

  async update(id: string, dto: UpdateCameraGroupDto) {
    const { cameraIds, ...data } = dto;
    const group = await this.prisma.cameraGroup.update({
      where: { id },
      data,
    });
    if (cameraIds !== undefined) {
      await this.prisma.camera.updateMany({
        where: { group_id: id },
        data: { group_id: null },
      });
      if (cameraIds.length > 0) {
        await this.prisma.camera.updateMany({
          where: { id: { in: cameraIds } },
          data: { group_id: id },
        });
      }
    }
    return this.findOne(group.id);
  }

  async remove(id: string) {
    await this.prisma.camera.updateMany({
      where: { group_id: id },
      data: { group_id: null },
    });
    return this.prisma.cameraGroup.delete({ where: { id } });
  }
}
