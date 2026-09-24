import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AchievementsService } from './achievements.service';
import { UpdateAchievementPinsDto } from './dto/update-achievement-pins.dto';

@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly service: AchievementsService) {}

  @Get()
  list(@Req() req) { return this.service.list(req.user.userId); }

  @Get('history')
  history(@Req() req) { return this.service.history(req.user.userId); }

  @Put('pins')
  updatePins(@Body() dto: UpdateAchievementPinsDto, @Req() req) {
    return this.service.updatePins(req.user.userId, dto.achievementIds);
  }
}
