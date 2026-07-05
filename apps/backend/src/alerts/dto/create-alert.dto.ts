import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AlertSeverity, AlertStatus } from '@prisma/client';

export class CreateAlertDto {
  @ApiProperty({ description: 'Associated event ID' })
  @IsString()
  @IsNotEmpty()
  event_id: string;

  @ApiProperty({ description: 'Alert type string' })
  @IsString()
  @IsNotEmpty()
  alert_type: string;

  @ApiProperty({ description: 'Camera ID', required: false })
  @IsString()
  @IsOptional()
  camera_id?: string;

  @ApiProperty({ description: 'Zone ID', required: false })
  @IsString()
  @IsOptional()
  zone_id?: string;

  @ApiProperty({ enum: AlertSeverity, default: AlertSeverity.MEDIUM })
  @IsEnum(AlertSeverity)
  @IsOptional()
  severity?: AlertSeverity;
}

export class UpdateAlertStatusDto {
  @ApiProperty({ enum: AlertStatus })
  @IsEnum(AlertStatus)
  @IsNotEmpty()
  status: AlertStatus;
}
