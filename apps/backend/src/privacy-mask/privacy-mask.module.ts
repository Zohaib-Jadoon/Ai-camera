import { Module } from '@nestjs/common';
import { PrivacyMaskService } from './privacy-mask.service';
import { PrivacyMaskController } from './privacy-mask.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  providers: [PrivacyMaskService],
  controllers: [PrivacyMaskController],
  exports: [PrivacyMaskService],
})
export class PrivacyMaskModule {}
