import { IsArray, ValidateNested, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class CameraImportItemDto {
  @IsString()
  name: string;

  @IsString()
  rtsp_url: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  detect_url?: string;

  @IsString()
  @IsOptional()
  record_url?: string;

  @IsString()
  @IsOptional()
  group_id?: string;
}

export class BulkImportCamerasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CameraImportItemDto)
  cameras: CameraImportItemDto[];
}
