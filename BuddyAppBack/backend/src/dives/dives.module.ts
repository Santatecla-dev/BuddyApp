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
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule, TypeOrmModule.forFeature([Dive, DiveBuddy, DiveInvite, DiveSighting, PlannedDive, DiveTrip, TripPlannedDive])],
  providers: [DivesService, PlannedDivesService, DiveTripsService],
  controllers: [DivesController, PokedexController, PlannedDivesController, DiveTripsController],
})
export class DivesModule {}
