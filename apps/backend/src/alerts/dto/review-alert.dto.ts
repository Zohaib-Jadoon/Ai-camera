import { IsIn, IsString, MinLength, MaxLength } from 'class-validator';
export class ReviewAlertDto {
  @IsIn(['CONFIRMED', 'DISMISSED']) verdict: 'CONFIRMED' | 'DISMISSED';
  @IsString() @MinLength(3) @MaxLength(1000) note: string;
}
