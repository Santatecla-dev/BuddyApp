import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivityFeedService } from './activity-feed.service';
import { CreateFeedCommentDto } from './dto/create-feed-comment.dto';

@UseGuards(JwtAuthGuard)
@Controller('activity-feed')
export class ActivityFeedController {
  constructor(private readonly service: ActivityFeedService) {}

  @Get('buddies')
  buddies(@Req() req) { return this.service.buddies(req.user.userId); }

  @Get()
  feed(@Query('type') type: 'all' | 'dives' | 'wildlife' | 'achievements' | 'mine', @Query('mineType') mineType: 'all' | 'dives' | 'wildlife' | 'achievements', @Query('buddyId') buddyId: string, @Query('cursor') cursor: string, @Query('limit') limit: string, @Req() req) {
    return this.service.feed(req.user.userId, type || 'all', Number(cursor) || 0, Number(limit) || 10, mineType || 'all', buddyId ? Number(buddyId) : undefined);
  }

  @Post(':activityId/like')
  like(@Param('activityId') activityId: string, @Req() req) { return this.service.toggleReaction(activityId, req.user.userId); }

  @Get(':activityId/comments')
  comments(@Param('activityId') activityId: string, @Req() req) { return this.service.comments(activityId, req.user.userId); }

  @Post(':activityId/comments')
  addComment(@Param('activityId') activityId: string, @Body() dto: CreateFeedCommentDto, @Req() req) { return this.service.addComment(activityId, dto, req.user.userId); }
}
