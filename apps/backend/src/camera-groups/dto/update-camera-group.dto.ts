import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateCameraGroupDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() location?: string;
  @IsArray() @IsOptional() cameraIds?: string[];
}
