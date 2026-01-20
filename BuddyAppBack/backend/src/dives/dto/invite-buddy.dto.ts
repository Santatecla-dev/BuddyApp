import { IsNumber } from 'class-validator';

export class InviteBuddyDto {
  @IsNumber()
  diveId: number;

  @IsNumber()
  invitedUserId: number;
}
