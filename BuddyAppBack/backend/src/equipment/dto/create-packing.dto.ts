import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class CreatePackingDto {
  @IsInt()
  @IsPositive()
  equipmentId: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  tripId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  plannedDiveId?: number;
}
