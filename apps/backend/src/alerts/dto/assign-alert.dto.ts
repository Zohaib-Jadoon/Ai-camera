import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignAlertDto {
  @ApiProperty({ description: 'User ID to assign the alert to' })
  @IsString()
  @IsNotEmpty()
  assigneeId: string;
}
