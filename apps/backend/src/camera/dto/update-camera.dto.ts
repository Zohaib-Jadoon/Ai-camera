import { IsString, IsOptional, IsIn, Matches } from 'class-validator';

export class UpdateCameraDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^rtsps?:\/\/.+/, {
    message: 'rtsp_url must be a valid RTSP URL starting with rtsp:// or rtsps://',
  })
  rtsp_url?: string;

  @IsOptional()
  @IsString()
  @Matches(/^rtsps?:\/\/.+/, {
    message: 'detect_url must be a valid RTSP URL starting with rtsp:// or rtsps://',
  })
  detect_url?: string;

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

  /** SOP (Standard Operating Procedure) model assigned to this camera. */
  @IsOptional()
  @IsString()
  sop_name?: string;
}
