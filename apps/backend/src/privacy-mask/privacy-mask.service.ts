import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreatePrivacyMaskDto {
  camera_id: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * PrivacyMaskService — manages rectangular regions that are blacked-out
 * on frames before AI inference.
 *
 * Masks are persisted in the DB and pushed to the AI Engine via the
 * `sync_cameras` socket event (masks are included in the camera payload).
 * The AI Engine's `apply_masks()` function blacks out the regions before
 * passing the frame to YOLO and FaceEngine.
 */
@Injectable()
export class PrivacyMaskService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePrivacyMaskDto) {
    return this.prisma.privacyMask.create({ data: dto });
  }

  async findByCamera(cameraId: string) {
    return this.prisma.privacyMask.findMany({
      where: { camera_id: cameraId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.privacyMask.findMany({
      orderBy: { createdAt: 'desc' },
      include: { camera: { select: { name: true } } },
    });
  }

  async remove(id: string) {
    return this.prisma.privacyMask.delete({ where: { id } });
  }

  async update(id: string, dto: Partial<CreatePrivacyMaskDto>) {
    return this.prisma.privacyMask.update({ where: { id }, data: dto });
  }
}
