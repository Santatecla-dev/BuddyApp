import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DIVE_COUNTRY_VALUES } from '../../dives/country.values';

export class UpdateCenterProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(180)
  legalName?: string;

  @IsOptional() @IsString() @MaxLength(40)
  taxId?: string;

  @IsOptional() @IsString() @MaxLength(120)
  contactName?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(240)
  website?: string;

  @IsOptional() @IsString() @MaxLength(120)
  address?: string;

  @IsOptional() @IsString() @MaxLength(20)
  postalCode?: string;

  @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @IsOptional() @IsIn(DIVE_COUNTRY_VALUES)
  country?: string;

  @IsOptional() @IsString() @MaxLength(80)
  timezone?: string;

  @IsOptional() @IsString() @MaxLength(1600)
  description?: string;

  @IsOptional() @IsString() @MaxLength(1200)
  openingHours?: string;

  @IsOptional() @IsString() @MaxLength(120)
  instagram?: string;

  @IsOptional() @IsString() @MaxLength(120)
  facebook?: string;
}
