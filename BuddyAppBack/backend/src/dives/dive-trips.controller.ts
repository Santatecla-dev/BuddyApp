import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDiveTripDto } from './dto/create-dive-trip.dto';
import { UpdateDiveTripDto } from './dto/update-dive-trip.dto';
import { DiveTripsService } from './dive-trips.service';

@UseGuards(JwtAuthGuard)
@Controller('dive-trips')
export class DiveTripsController {
  constructor(private readonly service: DiveTripsService) {}

  @Get()
  list(@Req() req) { return this.service.list(req.user.userId); }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.get(id, req.user.userId); }

  @Post()
  create(@Body() dto: CreateDiveTripDto, @Req() req) { return this.service.create(dto, req.user.userId); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDiveTripDto, @Req() req) { return this.service.update(id, dto, req.user.userId); }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.remove(id, req.user.userId); }

  @Post(':id/planned-dives/:plannedDiveId')
  attach(@Param('id', ParseIntPipe) id: number, @Param('plannedDiveId', ParseIntPipe) plannedDiveId: number, @Req() req) {
    return this.service.attach(id, plannedDiveId, req.user.userId);
  }

  @Delete(':id/planned-dives/:plannedDiveId')
  detach(@Param('id', ParseIntPipe) id: number, @Param('plannedDiveId', ParseIntPipe) plannedDiveId: number, @Req() req) {
    return this.service.detach(id, plannedDiveId, req.user.userId);
  }
}
