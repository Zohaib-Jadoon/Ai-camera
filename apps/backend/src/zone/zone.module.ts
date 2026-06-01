import { Module, forwardRef } from '@nestjs/common';
import { ZoneService } from './zone.service';
import { ZoneController } from './zone.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [forwardRef(() => EventsModule)],
  controllers: [ZoneController],
  providers: [ZoneService],
  exports: [ZoneService],
})
export class ZoneModule {}
