import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentService } from './equipment.service';
import { CreateServiceRecordDto } from './dto/create-service-record.dto';
import { CreatePackingDto } from './dto/create-packing.dto';
import { UpdatePackingDto } from './dto/update-packing.dto';

@UseGuards(JwtAuthGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  @Get()
  list(@Req() req) { return this.service.list(req.user.userId); }

  @Get('packing')
  listPacking(@Query('equipmentId') equipmentId: string, @Query('tripId') tripId: string, @Query('plannedDiveId') plannedDiveId: string, @Req() req) {
    return this.service.listPacking(req.user.userId, equipmentId ? Number(equipmentId) : undefined, tripId ? Number(tripId) : undefined, plannedDiveId ? Number(plannedDiveId) : undefined);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.get(id, req.user.userId); }

  @Get(':id/service-records')
  listServiceRecords(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.listServiceRecords(id, req.user.userId); }

  @Post(':id/service-records')
  createServiceRecord(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateServiceRecordDto, @Req() req) {
    return this.service.createServiceRecord(id, dto, req.user.userId);
  }

  @Delete('service-records/:recordId')
  removeServiceRecord(@Param('recordId', ParseIntPipe) recordId: number, @Req() req) {
    return this.service.removeServiceRecord(recordId, req.user.userId);
  }

  @Post('packing')
  createPacking(@Body() dto: CreatePackingDto, @Req() req) { return this.service.createPacking(dto, req.user.userId); }

  @Patch('packing/:id')
  updatePacking(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePackingDto, @Req() req) { return this.service.updatePacking(id, dto, req.user.userId); }

  @Delete('packing/:id')
  removePacking(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.removePacking(id, req.user.userId); }

  @Post()
  create(@Body() dto: CreateEquipmentDto, @Req() req) { return this.service.create(dto, req.user.userId); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEquipmentDto, @Req() req) { return this.service.update(id, dto, req.user.userId); }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.remove(id, req.user.userId); }
}
