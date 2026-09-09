import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { OmitType, PartialType } from '@nestjs/swagger';

export class CreatePrivacyMaskDto {
  @IsUUID()
  camera_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(1)
  x: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(1)
  y: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.000001)
  @Max(1)
  width: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.000001)
  @Max(1)
  height: number;
}

export class UpdatePrivacyMaskDto extends PartialType(OmitType(CreatePrivacyMaskDto, ['camera_id'] as const)) {}
