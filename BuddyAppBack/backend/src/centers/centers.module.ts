import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Dive } from '../dives/dive.entity';
import { DiveBuddy } from '../dives/dive-buddy.entity';
import { PlannedDive } from '../dives/planned-dive.entity';
import { User } from '../users/user.entity';
import { CenterInventoryItem } from './center-inventory-item.entity';
import { DiveCenter } from './dive-center.entity';
import { CentersController, DiveCentersController } from './centers.controller';
import { CentersService } from './centers.service';
import { CenterLinkRequest } from './center-link-request.entity';
import { DiveInvite } from '../dives/dive-invite.entity';
import { WarehouseMap } from './warehouse-map.entity';
import { WarehouseObject } from './warehouse-object.entity';
import { DiveSite } from './dive-site.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([DiveCenter, CenterInventoryItem, WarehouseMap, WarehouseObject, DiveSite, Dive, PlannedDive, DiveBuddy, DiveInvite, User, CenterLinkRequest])],
  controllers: [CentersController, DiveCentersController],
  providers: [CentersService],
  exports: [CentersService],
})
export class CentersModule {}
