import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsInt,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AlertSeverity } from '@prisma/client';

class AlertRuleScheduleDto {
  @IsInt() day_of_week: number;
  @IsString() start_time: string;
  @IsString() end_time: string;
}

export class UpdateAlertRuleDto {
  @IsString() @IsOptional() name?: string;
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsString() @IsOptional() camera_id?: string;
  @IsString() @IsOptional() zone_id?: string;
  @IsString() @IsOptional() object_type?: string;
  @IsString() @IsOptional() alert_type?: string;
  @IsEnum(AlertSeverity) @IsOptional() severity?: AlertSeverity;
  @IsString() @IsOptional() schedule_mode?: string;
  @IsInt() @IsOptional() cooldown_sec?: number;
  @IsObject() @IsOptional() actions?: Record<string, boolean>;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlertRuleScheduleDto)
  schedules?: AlertRuleScheduleDto[];
}
