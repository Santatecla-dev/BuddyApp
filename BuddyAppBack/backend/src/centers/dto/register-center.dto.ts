import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { DIVE_COUNTRY_VALUES } from '../../dives/country.values';

export class RegisterCenterDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  centerName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsString()
  @IsIn(DIVE_COUNTRY_VALUES)
  country: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;
}
