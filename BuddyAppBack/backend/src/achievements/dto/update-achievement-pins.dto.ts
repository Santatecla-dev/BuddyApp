import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class UpdateAchievementPinsDto {
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  achievementIds: string[];
}
