import { IsNumber } from 'class-validator';

export class RejectInviteDto {
  @IsNumber()
  inviteId: number;
}
