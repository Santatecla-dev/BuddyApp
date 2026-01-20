// dto/update-personal-notes.dto.ts
import { IsString } from 'class-validator';

export class UpdatePersonalNotesDto {
  @IsString()
  notes: string;
}
