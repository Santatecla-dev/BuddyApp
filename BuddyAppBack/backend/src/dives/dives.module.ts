import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DivesService } from './dives.service';
import { DivesController } from './dives.controller';
import { Dive } from './dive.entity';
import { DiveBuddy } from './dive-buddy.entity';
import { DiveInvite } from './dive-invite.entity';
import { DiveSighting } from './dive-sighting.entity';
import { PokedexController } from './pokedex.controller';
import { PlannedDive } from './planned-dive.entity';
import { PlannedDivesController } from './planned-dives.controller';
import { PlannedDivesService } from './planned-dives.service';

@Module({
  imports: [TypeOrmModule.forFeature([Dive, DiveBuddy, DiveInvite, DiveSighting, PlannedDive])],
  providers: [DivesService, PlannedDivesService],
  controllers: [DivesController, PokedexController, PlannedDivesController],
})
export class DivesModule {}
