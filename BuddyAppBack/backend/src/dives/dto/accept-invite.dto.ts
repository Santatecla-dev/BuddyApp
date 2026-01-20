import { IsNumber } from 'class-validator';

export class AcceptInviteDto {
  @IsNumber()
  inviteId: number;
}
