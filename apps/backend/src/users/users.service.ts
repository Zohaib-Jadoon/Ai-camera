import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    const rawPw = (data.password as string) || require('crypto').randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(rawPw, 10);
    return this.prisma.user.create({
      data: { ...data, password: hashedPassword },
    });
  }


  async findAll(): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, avatar_url: true, oauth_provider: true, oauth_id: true, createdAt: true, updatedAt: true }
    });
  }

  async findOne(email: string): Promise<User | null> {
    // SEC: Only return active users — deactivated accounts cannot authenticate
    return this.prisma.user.findUnique({ where: { email, isActive: true } });
  }

  async findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true, avatar_url: true, oauth_provider: true, oauth_id: true, createdAt: true, updatedAt: true }
    });
  }

  /**
   * Fix 5: If the update payload contains a new password, hash it and revoke
   * all existing refresh tokens so old sessions cannot outlive a password reset.
   * Uses PrismaService directly to avoid a circular dependency with AuthModule.
   */
  async update(id: string, data: Partial<Prisma.UserUpdateInput>): Promise<SafeUser> {
    if (data.password && typeof data.password === 'string') {
      // Hash the new password
      data = { ...data, password: await bcrypt.hash(data.password as string, 10) };
      // Revoke ALL refresh tokens for this user before applying the update
      await this.prisma.refreshToken.deleteMany({ where: { user_id: id } });
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, avatar_url: true, oauth_provider: true, oauth_id: true, createdAt: true, updatedAt: true }
    });
  }

  async remove(id: string): Promise<SafeUser> {
    return this.prisma.user.delete({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true, avatar_url: true, oauth_provider: true, oauth_id: true, createdAt: true, updatedAt: true }
    });
  }
}
