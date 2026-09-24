import { Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get('unread-count')
  unreadCount(@Req() req) { return this.service.unreadCount(req.user.userId); }

  @Get()
  list(@Query('unreadOnly') unreadOnly: string, @Query('cursor') cursor: string, @Query('limit') limit: string, @Req() req) {
    return this.service.list(req.user.userId, unreadOnly === 'true', Number(cursor) || 0, Number(limit) || 20);
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.markRead(id, req.user.userId); }

  @Post('read-all')
  markAllRead(@Req() req) { return this.service.markAllRead(req.user.userId); }
}
