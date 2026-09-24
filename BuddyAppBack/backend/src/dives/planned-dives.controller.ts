import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePlannedDiveDto } from './dto/create-planned-dive.dto';
import { CreateCenterPlannedDiveDto } from './dto/create-center-planned-dive.dto';
import { UpdatePlannedDiveDto } from './dto/update-planned-dive.dto';
import { PlannedDivesService } from './planned-dives.service';

@UseGuards(JwtAuthGuard)
@Controller('planned-dives')
export class PlannedDivesController {
  constructor(private readonly service: PlannedDivesService) {}

  @Get()
  list(@Req() req) { return this.service.list(req.user.userId); }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.get(id, req.user.userId); }

  @Post()
  create(@Body() dto: CreatePlannedDiveDto, @Req() req) { return this.service.create(dto, req.user.userId); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlannedDiveDto, @Req() req) { return this.service.update(id, dto, req.user.userId); }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.remove(id, req.user.userId); }

  @Post(':id/log')
  log(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.log(id, req.user.userId); }
  @Post('center')
  createForCenter(@Body() dto: CreateCenterPlannedDiveDto, @Req() req) { return this.service.createForCenter(dto, req.user.userId); }

  @Get('invites/pending')
  pendingInvites(@Req() req) { return this.service.pendingInvites(req.user.userId); }

  @Post('invite/:id/respond')
  respondInvite(@Param('id', ParseIntPipe) id: number, @Body() body: { accept: boolean }, @Req() req) { return this.service.respondInvite(id, req.user.userId, body.accept); }
}
