import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FacesService {
  private readonly logger = new Logger(FacesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAllPersons(tag?: string) {
    const where = tag ? { tag } : {};
    return this.prisma.person.findMany({
      where,
      include: {
        _count: { select: { faceEvents: true, faceEmbeddings: true } },
        faceEmbeddings: { select: { id: true } }, // ids only — no giant float[] vectors
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: { _count: { select: { faceEvents: true, faceEmbeddings: true } } },
    });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return person;
  }

  async createPerson(data: { name: string; tag?: string; photo_url?: string; alert_message?: string; alert_enabled?: boolean }) {
    const person = await this.prisma.person.create({ data });
    this.logger.log(`Person created: ${data.name} (${person.id})`);
    return person;
  }

  async updatePerson(id: string, data: Partial<{ name: string; tag?: string; photo_url?: string; alert_message?: string; alert_enabled?: boolean }>) {
    const person = await this.prisma.person.findUnique({ where: { id } });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return this.prisma.person.update({ where: { id }, data });
  }

  async deletePerson(id: string) {
    const person = await this.prisma.person.findUnique({ where: { id } });
    if (!person) throw new NotFoundException(`Person ${id} not found`);

    await this.prisma.faceEmbedding.deleteMany({ where: { person_id: id } });
    await this.prisma.person.delete({ where: { id } });
    this.logger.log(`Person deleted: ${id}`);
  }

  async addEmbedding(personId: string, embeddingVector: number[]) {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person) throw new NotFoundException(`Person ${personId} not found`);

    return this.prisma.faceEmbedding.create({
      data: { person_id: personId, embedding_vector: embeddingVector },
    });
  }

  async getAllEmbeddings() {
    return this.prisma.faceEmbedding.findMany({
      include: {
        person: {
          select: {
            id: true,
            name: true,
            tag: true,
            alert_message: true,
            alert_enabled: true,
          },
        },
      },
    });
  }

  async getFaceEvents(cameraId?: string, limit = 50) {
    const where = cameraId ? { camera_id: cameraId } : {};
    return this.prisma.faceEvent.findMany({
      where,
      include: {
        person: { select: { name: true, tag: true, photo_url: true, alert_message: true } },
        camera: { select: { name: true, location: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  async getUnknownFaces() {
    return this.prisma.faceEvent.findMany({
      where: { person_id: null },
      include: { camera: { select: { name: true, location: true } } },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
  }
}
