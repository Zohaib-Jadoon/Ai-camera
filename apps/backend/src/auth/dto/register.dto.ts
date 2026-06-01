import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Public registration DTO.
 * Role is intentionally absent — roles must be assigned by an ADMIN
 * via PATCH /api/users/:id after account creation.
 */
export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
