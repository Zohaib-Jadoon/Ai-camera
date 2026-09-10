import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TrainingService, TrainingOptions } from './training.service';

@ApiTags('training')
@Controller('training')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post('upload')
  @Roles('ADMIN', 'SECURITY_OPERATOR')
  @ApiOperation({ summary: 'Upload dataset ZIP and initiate YOLO model training' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max zip
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.zip')) {
          return cb(new BadRequestException('Only .zip archives are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadDataset(
    @UploadedFile() file: any,
    @Body() options: TrainingOptions,
  ) {
    if (!file) {
      throw new BadRequestException('Dataset ZIP file is required');
    }
    return this.trainingService.startTraining(file, options);
  }

  @Get('status/:sopName')
  @Roles('ADMIN', 'SECURITY_OPERATOR', 'VIEWER')
  @ApiOperation({ summary: 'Get live training progress, loss metrics, and log tail' })
  async getTrainingStatus(@Param('sopName') sopName: string) {
    return this.trainingService.getStatus(sopName);
  }

  @Get('models')
  @Roles('ADMIN', 'SECURITY_OPERATOR', 'VIEWER')
  @ApiOperation({ summary: 'List all fine-tuned models registered in ModelRegistry' })
  async listTrainedModels() {
    return this.trainingService.listModels();
  }

  @Post('deploy/:sopName')
  @Roles('ADMIN', 'SECURITY_OPERATOR')
  @ApiOperation({ summary: 'Hot-swap AI Engine active model to the specified SOP' })
  async deployModel(@Param('sopName') sopName: string) {
    return this.trainingService.deployModel(sopName);
  }
}
