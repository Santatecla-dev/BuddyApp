import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateDiveSiteDto {
  @IsOptional() @IsString() @IsIn(['panglao-bohol']) mapKey?: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(9.45) @Max(10.2) latitude: number;
  @IsNumber() @Min(123.55) @Max(124.55) longitude: number;
  @IsOptional() @IsNumber() @Min(0) @Max(200) minDepth?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(200) maxDepth?: number;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsString() currentInfo?: string;
  @IsOptional() @IsArray() highlights?: string[];
  @IsOptional() @IsArray() typicalSightings?: string[];
  @IsOptional() @IsArray() routes?: Array<{ name: string; notes?: string; points: Array<{ latitude: number; longitude: number; label?: string }> }>;
}
