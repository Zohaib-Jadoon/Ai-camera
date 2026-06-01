import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, ArrayNotEmpty, ArrayMinSize, ArrayMaxSize, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePersonDto {
  @ApiProperty({ description: 'Person full name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Tag: Employee, Family, Visitor, VIP, Blacklisted', required: false })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiProperty({ description: 'URL to reference photo', required: false })
  @IsString()
  @IsOptional()
  photo_url?: string;

  @ApiProperty({ description: 'Custom alert message when person is detected, e.g. "VIP Sarah has arrived"', required: false })
  @IsString()
  @IsOptional()
  alert_message?: string;

  @ApiProperty({ description: 'Whether to trigger alerts when this person is detected', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  alert_enabled?: boolean;
}

export class UpdatePersonDto {
  @ApiProperty({ description: 'Person full name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Tag: Employee, Family, Visitor, VIP, Blacklisted', required: false })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiProperty({ description: 'URL to reference photo', required: false })
  @IsString()
  @IsOptional()
  photo_url?: string;

  @ApiProperty({ description: 'Custom alert message when person is detected', required: false })
  @IsString()
  @IsOptional()
  alert_message?: string;

  @ApiProperty({ description: 'Whether to trigger alerts when this person is detected', required: false })
  @IsBoolean()
  @IsOptional()
  alert_enabled?: boolean;
}

export class AddEmbeddingDto {
  @ApiProperty({
    description: 'Face embedding vector — typically 512 floats from InsightFace',
    type: [Number],
    minItems: 128,
    maxItems: 1024,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(128, { message: 'Embedding vector must have at least 128 dimensions' })
  @ArrayMaxSize(1024, { message: 'Embedding vector must have at most 1024 dimensions' })
  @IsNumber({}, { each: true, message: 'Every element in embedding_vector must be a number' })
  embedding_vector: number[];
}
