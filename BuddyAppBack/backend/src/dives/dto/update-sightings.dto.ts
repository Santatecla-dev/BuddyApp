import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class UpdateSightingsDto {
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  speciesKeys: string[];
}

export class AddSightingsToDivesDto {
  @IsArray()
  @ArrayMaxSize(100)
  diveIds: number[];

  @IsString()
  speciesKey: string;
}
