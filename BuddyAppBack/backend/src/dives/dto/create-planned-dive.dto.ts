import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { DIVE_COUNTRY_VALUES } from '../country.values';

export class CreatePlannedDiveDto {
  @IsDateString({}, { message: 'The planned date is invalid' })
  date: string;

  @IsIn(DIVE_COUNTRY_VALUES, { message: 'The country is invalid' })
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsNumber()
  @Min(1)
  @Max(130)
  maxDepth: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  duration: number;

  @IsString()
  @IsNotEmpty()
  buddy: string;

  @IsString()
  @IsNotEmpty()
  condition: string;

  @IsString()
  @IsNotEmpty()
  gas: string;

  @IsBoolean()
  shoreEntry: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  checklist?: Record<string, boolean>;
}
