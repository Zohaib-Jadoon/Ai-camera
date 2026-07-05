import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string) {
    let settings = await this.prisma.userSettings.findUnique({
      where: { user_id: userId },
    });

    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: { user_id: userId },
      });
    }

    return settings;
  }

  async update(userId: string, data: any) {
    const existing = await this.findByUserId(userId);
    return this.prisma.userSettings.update({
      where: { id: existing.id },
      data,
    });
  }
}
