import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { DIVE_COUNTRY_VALUES } from '../country.values';

export class UpdatePlannedDiveDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsIn(DIVE_COUNTRY_VALUES) @IsNotEmpty() country?: string;
  @IsOptional() @IsString() @IsNotEmpty() location?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(130) maxDepth?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1440) duration?: number;
  @IsOptional() @IsString() @IsNotEmpty() buddy?: string;
  @IsOptional() @IsString() @IsNotEmpty() condition?: string;
  @IsOptional() @IsString() @IsNotEmpty() gas?: string;
  @IsOptional() @IsBoolean() shoreEntry?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsObject() checklist?: Record<string, boolean>;
  @IsOptional() @IsInt() centerId?: number;
}
