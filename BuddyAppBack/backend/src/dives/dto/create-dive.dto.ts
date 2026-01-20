import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { DiveCountry } from 'src/dives/dive-country.enum';

export class CreateDiveDto {
  @IsDateString({}, { message: 'La fecha no es válida' })
  date: string;

  @IsEnum(DiveCountry, { message: 'El país no es válido' })
  @IsNotEmpty({ message: 'El país es obligatorio' })
  country: DiveCountry;

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
}
