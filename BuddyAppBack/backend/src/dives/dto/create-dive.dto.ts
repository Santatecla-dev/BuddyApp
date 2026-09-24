import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsIn,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { DIVE_COUNTRY_VALUES } from '../country.values';

export class CreateDiveDto {
  @IsDateString({}, { message: 'La fecha no es válida' })
  date: string;

  @IsIn(DIVE_COUNTRY_VALUES, { message: 'El país no es válido' })
  @IsNotEmpty({ message: 'El país es obligatorio' })
  country: string;

  @IsString({ message: 'La localización debe ser un texto' })
  @IsNotEmpty({ message: 'La localización es obligatoria' })
  location: string;

  @IsNumber({}, { message: 'La profundidad máxima debe ser un número' })
  maxDepth: number;

  @IsNumber({}, { message: 'La duración debe ser un número' })
  duration: number;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser un texto' })
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  sightings?: string[];

  @IsOptional()
  @IsNumber()
  centerId?: number;
}
