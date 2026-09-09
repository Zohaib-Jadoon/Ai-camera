import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CreatePrivacyMaskDto, UpdatePrivacyMaskDto } from './dto/privacy-mask.dto';

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
  constructor(private readonly prisma: PrismaService, private readonly gateway: EventsGateway) {}

  private validateBounds(mask: { x: number; y: number; width: number; height: number }) {
    const values = [mask.x, mask.y, mask.width, mask.height];
    if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value)) ||
        mask.x < 0 || mask.y < 0 || mask.width <= 0 || mask.height <= 0 ||
        mask.x + mask.width > 1.000001 || mask.y + mask.height > 1.000001) {
      throw new BadRequestException('Privacy mask must fit inside the camera frame');
    }
  }

  async create(dto: CreatePrivacyMaskDto) {
    this.validateBounds(dto);
    const mask = await this.prisma.privacyMask.create({ data: dto });
    await this.gateway.broadcastCameraSync();
    return mask;
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
    const mask = await this.prisma.privacyMask.delete({ where: { id } });
    await this.gateway.broadcastCameraSync();
    return mask;
  }

  async update(id: string, dto: UpdatePrivacyMaskDto) {
    const existing = await this.prisma.privacyMask.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Privacy mask not found');
    this.validateBounds({ ...existing, ...dto });
    const mask = await this.prisma.privacyMask.update({ where: { id }, data: dto });
    await this.gateway.broadcastCameraSync();
    return mask;
  }
}
