import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AlertSeverity } from '@prisma/client';

class EscalationStepDto {
  @IsInt() step_number: number;
  @IsInt() delay_min: number;
  @IsString() channel: string;
  @IsString() target: string;
}

export class UpdateEscalationPolicyDto {
  @IsString() @IsOptional() name?: string;
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsString() @IsOptional() alert_type?: string;
  @IsEnum(AlertSeverity) @IsOptional() min_severity?: AlertSeverity;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalationStepDto)
  steps?: EscalationStepDto[];
}
