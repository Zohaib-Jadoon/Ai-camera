import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEscalationPolicyDto } from './dto/create-escalation-policy.dto';
import { UpdateEscalationPolicyDto } from './dto/update-escalation-policy.dto';

@Injectable()
export class EscalationService {
  constructor(private readonly prisma: PrismaService) {}

  async createPolicy(dto: CreateEscalationPolicyDto) {
    const { steps, ...data } = dto;
    return this.prisma.escalationPolicy.create({
      data: {
        ...data,
        steps: steps ? { create: steps } : undefined,
      },
      include: { steps: { orderBy: { step_number: 'asc' } } },
    });
  }

  async findAll() {
    return this.prisma.escalationPolicy.findMany({
      include: { steps: { orderBy: { step_number: 'asc' } } },
    });
  }

  async findOne(id: string) {
    const policy = await this.prisma.escalationPolicy.findUnique({
      where: { id },
      include: { steps: { orderBy: { step_number: 'asc' } } },
    });
    if (!policy) throw new NotFoundException('Escalation policy not found');
    return policy;
  }

  async update(id: string, dto: UpdateEscalationPolicyDto) {
    const { steps, ...data } = dto;
    return this.prisma.escalationPolicy.update({
      where: { id },
      data: {
        ...data,
        steps: steps ? { deleteMany: {}, create: steps } : undefined,
      },
      include: { steps: { orderBy: { step_number: 'asc' } } },
    });
  }

  async remove(id: string) {
    return this.prisma.escalationPolicy.delete({ where: { id } });
  }
}
