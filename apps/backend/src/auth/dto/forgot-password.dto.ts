import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Registered email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
