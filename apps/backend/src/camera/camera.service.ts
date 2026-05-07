import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Camera, Prisma } from '@prisma/client';

@Injectable()
export class CameraService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Camera[]> {
    return this.prisma.camera.findMany({
      include: { zones: true },
    });
  }

  async findOne(id: string): Promise<Camera | null> {
    return this.prisma.camera.findUnique({
      where: { id },
      include: { zones: true },
    });
  }

  async create(data: Prisma.CameraCreateInput): Promise<Camera> {
    return this.prisma.camera.create({ data });
  }

  async update(id: string, data: Prisma.CameraUpdateInput): Promise<Camera> {
    return this.prisma.camera.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Camera> {
    return this.prisma.camera.delete({
      where: { id },
    });
  }
}
