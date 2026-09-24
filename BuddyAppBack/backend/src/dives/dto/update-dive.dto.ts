import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateDiveDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() @MinLength(1) location?: string;
  @IsOptional() @IsNumber() @Min(1) maxDepth?: number;
  @IsOptional() @IsInt() @Min(1) duration?: number;
  @IsOptional() @IsString() notes?: string | null;
}
