import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dive } from '../dives/dive.entity';
import { DiveBuddy } from '../dives/dive-buddy.entity';
import { DiveSighting } from '../dives/dive-sighting.entity';
import { AchievementPin } from './achievement-pin.entity';
import { AchievementState } from './achievement-state.entity';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';

@Module({
  imports: [TypeOrmModule.forFeature([Dive, DiveBuddy, DiveSighting, AchievementState, AchievementPin])],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
