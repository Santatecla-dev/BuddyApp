/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import { DivesService } from './dives.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDiveDto } from './dto/create-dive.dto';
import { InviteBuddyDto } from './dto/invite-buddy.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { RejectInviteDto } from './dto/reject-invite.dto';
import { ParseIntPipe } from '@nestjs/common';
import { UpdatePersonalNotesDto } from './dto/update-personal-notes.dto';

@UseGuards(JwtAuthGuard)
@Controller('dives')
export class DivesController {
  constructor(private readonly divesService: DivesService) {}

  @Post()
  createDive(@Body() dto: CreateDiveDto, @Req() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.divesService.createDive(dto, req.user.userId);
  }
  @Post('invite')
  inviteBuddy(@Body() dto: InviteBuddyDto, @Req() req) {
    return this.divesService.inviteBuddy(
      dto.diveId,
      dto.invitedUserId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      req.user.userId,
    );
  }
  @Post('invite/accept')
  acceptInvite(@Body() dto: AcceptInviteDto, @Req() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.divesService.acceptInvite(dto.inviteId, req.user.userId);
  }
  @Post('invite/reject')
  rejectInvite(@Body() dto: RejectInviteDto, @Req() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.divesService.rejectInvite(dto.inviteId, req.user.userId);
  }
  @Get('invites/pending')
  getPendingInvites(@Req() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.divesService.getPendingInvites(req.user.userId);
  }
  @Get('my')
  getMyDives(@Req() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.divesService.getMyDives(req.user.userId);
  }
  @Get(':id/buddies')
  getDiveBuddies(@Param('id', ParseIntPipe) diveId: number) {
    return this.divesService.getDiveBuddies(diveId);
  }
  @Patch(':diveId/leave')
  leaveDive(@Param('diveId', ParseIntPipe) diveId: number, @Req() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.divesService.leaveDive(diveId, req.user.userId);
  }

  @Get(':diveId/personal-notes')
  getMyPersonalNotes(@Param('diveId') diveId: number, @Req() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.divesService.getMyPersonalNotes(diveId, req.user.userId);
  }

  @Patch(':diveId/personal-notes')
  updatePersonalNotes(
    @Param('diveId') diveId: number,
    @Body() dto: UpdatePersonalNotesDto,
    @Req() req,
  ) {
    return this.divesService.updatePersonalNotes(
      diveId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      req.user.userId,
      dto.notes,
    );
  }
}
