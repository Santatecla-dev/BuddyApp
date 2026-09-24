import { IsBoolean } from 'class-validator';

export class RespondCenterLinkDto {
  @IsBoolean()
  accept: boolean;
}
