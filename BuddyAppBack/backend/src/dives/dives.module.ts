import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DivesService } from './dives.service';
import { DivesController } from './dives.controller';
import { Dive } from './dive.entity';
import { DiveBuddy } from './dive-buddy.entity';
import { DiveInvite } from './dive-invite.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Dive, DiveBuddy, DiveInvite])],
  providers: [DivesService],
  controllers: [DivesController],
})
export class DivesModule {}
