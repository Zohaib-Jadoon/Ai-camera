import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateCameraGroupDto {
  @IsString() name: string;
  @IsString() @IsOptional() location?: string;
  @IsArray() @IsOptional() cameraIds?: string[];
}
