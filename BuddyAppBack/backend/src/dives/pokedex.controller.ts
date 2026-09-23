import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DivesService } from './dives.service';
import { AddSightingsToDivesDto } from './dto/update-sightings.dto';

@UseGuards(JwtAuthGuard)
@Controller('pokedex')
export class PokedexController {
  constructor(private readonly divesService: DivesService) {}

  @Get('species')
  getSpecies() {
    return this.divesService.getPokedexSpecies();
  }

  @Get()
  getPokedex(@Req() req) {
    return this.divesService.getPokedex(req.user.userId);
  }

  @Post('sightings')
  addSightingToDives(@Body() dto: AddSightingsToDivesDto, @Req() req) {
    return this.divesService.addSightingToDives(dto, req.user.userId);
  }
}
