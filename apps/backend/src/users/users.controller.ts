import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all users (ADMIN only)' })
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * ADMIN can invite a new user (pre-set role/name/email).
   * A random password is set; user should reset via forgot-password flow.
   */
  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Invite / create a user (ADMIN only)' })
  async invite(
    @Body() body: { name: string; email: string; role?: Role; password?: string },
  ) {
    const password = body.password ?? Math.random().toString(36).slice(-10) + 'Aa1!';
    return this.usersService.create({
      name: body.name,
      email: body.email,
      password,
      role: body.role ?? Role.VIEWER,
    });
  }

  /**
   * A user may fetch their own profile.
   * Only ADMIN may fetch any other user's profile.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (self or ADMIN)' })
  findOne(@Param('id') id: string, @Req() req: any) {
    const requestingUser = req.user;
    if (requestingUser.sub !== id && requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenException('You may only access your own profile');
    }
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile (self) or any user (ADMIN)' })
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { name?: string; email?: string; role?: Role; isActive?: boolean; avatar_url?: string },
  ) {
    const requestingUser = req.user;
    const isSelf = requestingUser.sub === id;
    const isAdmin = requestingUser.role === Role.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('You may only edit your own profile');
    }

    // Non-admins cannot change role or isActive
    if (!isAdmin) {
      delete body.role;
      delete body.isActive;
    }

    return this.usersService.update(id, body);
  }

  @Patch(':id/activate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Activate or deactivate a user (ADMIN only)' })
  async toggleActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.usersService.update(id, { isActive: body.isActive });
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete user (ADMIN only)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
