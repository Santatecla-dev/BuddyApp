import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentController } from './equipment.controller';
import { Equipment } from './equipment.entity';
import { EquipmentService } from './equipment.service';
import { EquipmentServiceRecord } from './equipment-service-record.entity';
import { EquipmentPacking } from './equipment-packing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Equipment, EquipmentServiceRecord, EquipmentPacking])],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
