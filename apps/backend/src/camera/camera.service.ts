import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Camera, Prisma } from '@prisma/client';

@Injectable()
export class CameraService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Camera[]> {
    return this.prisma.camera.findMany();
  }

  async findOne(id: string): Promise<Camera | null> {
    return this.prisma.camera.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.CameraCreateInput): Promise<Camera> {
    return this.prisma.camera.create({
      data,
    });
  }

  async update(id: string, data: Prisma.CameraUpdateInput): Promise<Camera | null> {
    return this.prisma.camera.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.camera.delete({
      where: { id },
    });
  }
}
