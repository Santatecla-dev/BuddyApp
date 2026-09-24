import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dive } from '../dives/dive.entity';
import { DiveBuddy } from '../dives/dive-buddy.entity';
import { DiveSighting } from '../dives/dive-sighting.entity';
import { AchievementsModule } from '../achievements/achievements.module';
import { User } from '../users/user.entity';
import { FeedComment } from './feed-comment.entity';
import { FeedReaction } from './feed-reaction.entity';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedService } from './activity-feed.service';

@Module({
  imports: [AchievementsModule, TypeOrmModule.forFeature([Dive, DiveBuddy, DiveSighting, User, FeedComment, FeedReaction])],
  controllers: [ActivityFeedController],
  providers: [ActivityFeedService],
})
export class ActivityFeedModule {}
