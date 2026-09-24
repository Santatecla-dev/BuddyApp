import { ArrayMaxSize, IsArray, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDiveDto } from '../../dives/dto/create-dive.dto';

export class CreateCenterDiveDto extends CreateDiveDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Type(() => Number)
  buddyUserIds?: number[];
}
