import { Module } from '@nestjs/common';
import { CameraGroupsService } from './camera-groups.service';
import { CameraGroupsController } from './camera-groups.controller';

@Module({
  controllers: [CameraGroupsController],
  providers: [CameraGroupsService],
})
export class CameraGroupsModule {}
