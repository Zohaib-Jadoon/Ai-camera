import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req: Request, @Query('unreadOnly') unreadOnly?: string) {
    const userId = (req.user as any).id;
    return this.notificationsService.findAll(userId, unreadOnly === 'true');
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as any).id;
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.notificationsService.markAllAsRead(userId);
  }
}
