import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateServiceRecordDto {
  @IsDateString()
  serviceDate: string;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
