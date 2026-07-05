import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartStreamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  cameraId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rtspUrl: string;
}

export class TestConnectionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rtspUrl: string;
}
