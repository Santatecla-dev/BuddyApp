import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateWarehouseObjectDto {
  @IsOptional() @IsIn(['rack', 'shelf', 'workbench', 'zone', 'compressor'])
  type?: 'rack' | 'shelf' | 'workbench' | 'zone' | 'compressor';
  @IsOptional() @IsString() @IsNotEmpty()
  label?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100)
  x?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100)
  y?: number;
  @IsOptional() @IsInt() @Min(1) @Max(24)
  width?: number;
  @IsOptional() @IsInt() @Min(1) @Max(16)
  height?: number;
  @IsOptional() @IsString()
  color?: string;
  @IsOptional() @IsString()
  notes?: string;
  @IsOptional() @IsInt() @IsIn([0, 45, 90, 135, 180, 225, 270, 315])
  rotation?: number;
}
