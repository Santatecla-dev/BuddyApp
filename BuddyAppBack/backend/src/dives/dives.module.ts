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
import { DiveTrip } from './dive-trip.entity';
import { TripPlannedDive } from './trip-planned-dive.entity';
import { DiveTripsController } from './dive-trips.controller';
import { DiveTripsService } from './dive-trips.service';
import { DiveCenter } from '../centers/dive-center.entity';
import { CenterLinkRequest } from '../centers/center-link-request.entity';
import { PlannedDiveInvite } from './planned-dive-invite.entity';
import { PlannedDiveBuddy } from './planned-dive-buddy.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Dive, DiveBuddy, DiveInvite, DiveSighting, PlannedDive, PlannedDiveInvite, PlannedDiveBuddy, User, DiveTrip, TripPlannedDive, DiveCenter, CenterLinkRequest])],
  providers: [DivesService, PlannedDivesService, DiveTripsService],
  controllers: [DivesController, PokedexController, PlannedDivesController, DiveTripsController],
})
export class DivesModule {}
