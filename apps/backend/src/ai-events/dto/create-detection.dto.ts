import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDetectionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  camera_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  object_type: string;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  snapshot_url?: string;
}

export class CreateFaceEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  camera_id: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  person_id?: string;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;
}
