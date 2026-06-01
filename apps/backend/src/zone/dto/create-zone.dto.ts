import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateZoneDto {
  @ApiProperty({ description: 'Camera ID this zone belongs to' })
  @IsString()
  @IsNotEmpty()
  camera_id: string;

  @ApiPropertyOptional({ description: 'Human-readable zone name, e.g. "North Gate"' })
  @IsString()
  @IsOptional()
  name?: string;

  /**
   * Polygon points — stored as a Prisma Json field.
   * The canvas editor sends normalised [[x,y],[x,y],...] pairs (0.0–1.0).
   * We accept any JSON value here (validated by Prisma at query time).
   */
  @ApiProperty({
    description: 'Polygon points: array of [x, y] pairs normalised 0–1 from canvas editor',
    example: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
  })
  @IsArray()
  @IsNotEmpty()
  polygon_points: any[];

  @ApiProperty({ description: 'Rule type: intrusion | loitering | line_crossing | perimeter' })
  @IsString()
  @IsNotEmpty()
  rule_type: string;
}
