import { IsString, IsBoolean, IsOptional, IsArray, IsUrl, IsObject } from 'class-validator';

export class UpdateWebhookDto {
  @IsString() @IsOptional() name?: string;
  @IsUrl() @IsOptional() url?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() events?: string[];
  @IsString() @IsOptional() secret?: string;
  @IsObject() @IsOptional() headers?: Record<string, string>;
  @IsBoolean() @IsOptional() enabled?: boolean;
}
