import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateInventoryItemDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() @IsNotEmpty() category?: string;
  @IsOptional() @IsInt() @Min(0) quantity?: number;
  @IsOptional() @IsIn(['available', 'maintenance', 'retired']) status?: 'available' | 'maintenance' | 'retired';
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() nextServiceDate?: string;
  @IsOptional() @IsInt() @Min(0) warehouseObjectId?: number | null;
}
