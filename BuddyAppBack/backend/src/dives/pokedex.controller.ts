import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  /**
   * The map is intentionally not scoped to the current diver.  A centre and a
   * diver should see the same community sightings, while the JWT still keeps
   * the endpoint private to signed-in accounts.
   */
  @Get('marine-map')
  getMarineLifeMap(@Query('speciesKey') speciesKey?: string, @Query('period') period?: string) {
    return this.divesService.getMarineLifeMap(speciesKey, period);
  }

  @Post('sightings')
  addSightingToDives(@Body() dto: AddSightingsToDivesDto, @Req() req) {
    return this.divesService.addSightingToDives(dto, req.user.userId);
  }
}
