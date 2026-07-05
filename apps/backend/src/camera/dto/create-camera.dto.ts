import { IsString, IsOptional, IsIn, IsNotEmpty, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCameraDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * SEC-5: SSRF prevention — only rtsp:// and rtsps:// protocols are accepted.
   * Rejects http://, file://, dict://, gopher:// etc. that could be used for SSRF.
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^rtsps?:\/\/.+/, {
    message: 'rtsp_url must be a valid RTSP URL starting with rtsp:// or rtsps://',
  })
  rtsp_url: string;

  /**
   * 🐦 Frigate dual-stream: low-res detection stream (e.g. 640×360).
   * If omitted the AI Engine uses rtsp_url for detection.
   */
  @ApiPropertyOptional({ description: 'Low-res RTSP stream for AI detection (Frigate dual-stream)' })
  @IsOptional()
  @IsString()
  @Matches(/^rtsps?:\/\/.+/, {
    message: 'detect_url must be a valid RTSP URL starting with rtsp:// or rtsps://',
  })
  detect_url?: string;

  /**
   * 🐦 Frigate dual-stream: high-res recording stream (e.g. 1080p).
   * If omitted the AI Engine uses rtsp_url for recording.
   */
  @ApiPropertyOptional({ description: 'High-res RTSP stream for recording (Frigate dual-stream)' })
  @IsOptional()
  @IsString()
  @Matches(/^rtsps?:\/\/.+/, {
    message: 'record_url must be a valid RTSP URL starting with rtsp:// or rtsps://',
  })
  record_url?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(['ONLINE', 'OFFLINE', 'ERROR'])
  status?: 'ONLINE' | 'OFFLINE' | 'ERROR';

  /** SOP (Standard Operating Procedure) model to use for this camera. */
  @IsOptional()
  @IsString()
  sop_name?: string;
}

