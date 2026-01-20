import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 🔒 Obtener mi perfil
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: Request) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.usersService.getProfile(userId);
  }

  // 🔒 Actualizar mi perfil
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.usersService.updateProfile(userId, dto);
  }

  // 🔒 Obtener perfil público de otro usuario
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(+id);
  }

  // 🔒 Obtener total de inmersiones propias
  @UseGuards(JwtAuthGuard)
  @Get('me/total-dives')
  async getMyTotalDives(@Req() req: Request) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.usersService.getTotalDives(userId);
  }

  // 🔒 Obtener total de inmersiones de otro usuario
  @UseGuards(JwtAuthGuard)
  @Get(':id/total-dives')
  async getUserTotalDives(@Param('id') id: string) {
    return this.usersService.getTotalDives(+id);
  }
  @UseGuards(JwtAuthGuard)
  @Get(':id/shared-dives')
  async getSharedDives(@Param('id') id: string, @Req() req: Request) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const myUserId = (req.user as any).userId;
    return {
      sharedDives: await this.usersService.getSharedDivesWithUser(
        +id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        myUserId,
      ),
    };
  }
}
