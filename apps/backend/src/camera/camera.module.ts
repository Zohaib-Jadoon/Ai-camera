import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Camera } from './camera.entity';
import { CameraService } from './camera.service';
import { CameraController } from './camera.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Camera])],
  providers: [CameraService],
  controllers: [CameraController],
  exports: [CameraService],
})
export class CameraModule {}
