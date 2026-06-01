import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { S3Service } from './s3.service';

@Module({
  controllers: [StorageController],
  providers: [StorageService, S3Service],
  exports: [StorageService, S3Service],
})
export class StorageModule {}
