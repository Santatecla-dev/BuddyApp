import { IsBoolean } from 'class-validator';

export class UpdatePackingDto {
  @IsBoolean()
  packed: boolean;
}
