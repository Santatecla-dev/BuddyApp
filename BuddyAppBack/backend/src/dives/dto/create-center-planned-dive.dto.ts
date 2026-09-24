import { ArrayMaxSize, IsArray, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePlannedDiveDto } from './create-planned-dive.dto';

export class CreateCenterPlannedDiveDto extends CreatePlannedDiveDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Type(() => Number)
  buddyUserIds?: number[];
}
