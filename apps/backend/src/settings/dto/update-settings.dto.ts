import { IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Enable AI processing' })
  @IsOptional()
  @IsBoolean()
  ai_enabled?: boolean;

  @ApiPropertyOptional({ description: 'AI confidence threshold', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence_threshold?: number;

  @ApiPropertyOptional({ description: 'Enable email notifications' })
  @IsOptional()
  @IsBoolean()
  notification_email?: boolean;

  @ApiPropertyOptional({ description: 'Enable push notifications' })
  @IsOptional()
  @IsBoolean()
  notification_push?: boolean;

  @ApiPropertyOptional({ description: 'Enable SMS notifications' })
  @IsOptional()
  @IsBoolean()
  notification_sms?: boolean;
}
