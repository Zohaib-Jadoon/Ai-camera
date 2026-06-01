import { IsString, IsBoolean, IsOptional, IsArray, IsUrl, IsObject } from 'class-validator';

export class CreateWebhookDto {
  @IsString() name: string;
  @IsUrl() url: string;
  @IsArray() @IsString({ each: true }) events: string[];
  @IsString() @IsOptional() secret?: string;
  @IsObject() @IsOptional() headers?: Record<string, string>;
  @IsBoolean() @IsOptional() enabled?: boolean;
}
