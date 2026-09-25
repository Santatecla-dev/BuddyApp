import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CentersService } from './centers.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { CreateCenterDiveDto } from './dto/create-center-dive.dto';
import { RespondCenterLinkDto } from './dto/respond-center-link.dto';
import { CreateInventoryBulkDto } from './dto/create-inventory-bulk.dto';
import { UpdateCenterProfileDto } from './dto/update-center-profile.dto';
import { CreateWarehouseObjectDto } from './dto/create-warehouse-object.dto';
import { UpdateWarehouseObjectDto } from './dto/update-warehouse-object.dto';
import { UpdateWarehouseMapDto } from './dto/update-warehouse-map.dto';
import { CreateDiveSiteDto } from './dto/create-dive-site.dto';
import { UpdateDiveSiteDto } from './dto/update-dive-site.dto';

@UseGuards(JwtAuthGuard)
@Controller('center')
export class CentersController {
  constructor(private readonly service: CentersService) {}

  @Get('dashboard')
  dashboard(@Req() req) { return this.service.dashboard(req.user.userId); }

  @Get('profile')
  profile(@Req() req) { return this.service.profile(req.user.userId); }

  @Patch('profile')
  updateProfile(@Body() dto: UpdateCenterProfileDto, @Req() req) { return this.service.updateProfile(req.user.userId, dto); }

  @Get('operation-map')
  operationMap(@Req() req) { return this.service.getOperationMap(req.user.userId); }

  @Patch('operation-map')
  selectOperationMap(@Body() body: { mapKey: string }, @Req() req) { return this.service.selectOperationMap(req.user.userId, body.mapKey); }

  @Get('dive-sites')
  diveSites(@Req() req) { return this.service.listDiveSites(req.user.userId); }

  @Get('dive-sites/:id')
  diveSite(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.getDiveSite(req.user.userId, id); }

  @Post('dive-sites')
  createDiveSite(@Body() dto: CreateDiveSiteDto, @Req() req) { return this.service.createDiveSite(req.user.userId, dto); }

  @Patch('dive-sites/:id')
  updateDiveSite(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDiveSiteDto, @Req() req) { return this.service.updateDiveSite(req.user.userId, id, dto); }

  @Delete('dive-sites/:id')
  removeDiveSite(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.removeDiveSite(req.user.userId, id); }

  @Get('warehouse')
  warehouse(@Req() req) { return this.service.getWarehouse(req.user.userId); }

  @Patch('warehouse')
  updateWarehouse(@Body() dto: UpdateWarehouseMapDto, @Req() req) { return this.service.updateWarehouse(req.user.userId, dto); }

  @Post('warehouse/objects')
  createWarehouseObject(@Body() dto: CreateWarehouseObjectDto, @Req() req) { return this.service.createWarehouseObject(req.user.userId, dto); }

  @Delete('warehouse/objects')
  clearWarehouse(@Req() req) { return this.service.clearWarehouse(req.user.userId); }

  @Patch('warehouse/objects/:id')
  updateWarehouseObject(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWarehouseObjectDto, @Req() req) { return this.service.updateWarehouseObject(id, req.user.userId, dto); }

  @Delete('warehouse/objects/:id')
  removeWarehouseObject(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.removeWarehouseObject(id, req.user.userId); }

  @Post('dives')
  createDive(@Body() dto: CreateCenterDiveDto, @Req() req) { return this.service.createDive(req.user.userId, dto); }

  @Get('link-requests')
  linkRequests(@Req() req) { return this.service.listLinkRequests(req.user.userId); }

  @Patch('link-requests/:id')
  respondLinkRequest(@Param('id', ParseIntPipe) id: number, @Body() dto: RespondCenterLinkDto, @Req() req) {
    return this.service.respondToLinkRequest(id, req.user.userId, dto.accept);
  }

  @Get('inventory')
  inventory(@Req() req) { return this.service.listInventory(req.user.userId); }

  @Post('inventory')
  createInventory(@Body() dto: CreateInventoryItemDto, @Req() req) { return this.service.createInventory(req.user.userId, dto); }

  @Post('inventory/bulk')
  createInventoryBulk(@Body() dto: CreateInventoryBulkDto, @Req() req) { return this.service.createInventoryBulk(req.user.userId, dto); }

  @Patch('inventory/:id')
  updateInventory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInventoryItemDto, @Req() req) { return this.service.updateInventory(id, req.user.userId, dto); }

  @Delete('inventory/:id')
  removeInventory(@Param('id', ParseIntPipe) id: number, @Req() req) { return this.service.removeInventory(id, req.user.userId); }

  @Get('clients')
  clients(@Req() req) { return this.service.listClients(req.user.userId); }
}

@UseGuards(JwtAuthGuard)
@Controller('dive-centers')
export class DiveCentersController {
  constructor(private readonly service: CentersService) {}

  @Get()
  list(@Req() req) { return this.service.publicList(req.query?.search); }

  @Get(':id/dive-sites')
  publicDiveSites(@Param('id', ParseIntPipe) id: number) { return this.service.publicDiveSites(id); }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) { return this.service.publicGet(id); }
}
