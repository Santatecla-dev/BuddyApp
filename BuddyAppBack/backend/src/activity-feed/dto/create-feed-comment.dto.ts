import { IsString, Length } from 'class-validator';

export class CreateFeedCommentDto {
  @IsString()
  @Length(1, 500)
  body: string;
}
