import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateWarehouseMapDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsInt() @Min(6) @Max(80)
  width?: number;

  @IsOptional() @IsInt() @Min(6) @Max(60)
  height?: number;
}
