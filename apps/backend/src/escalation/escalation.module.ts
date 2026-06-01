import { Module } from '@nestjs/common';
import { EscalationService } from './escalation.service';
import { EscalationController } from './escalation.controller';

@Module({
  controllers: [EscalationController],
  providers: [EscalationService],
})
export class EscalationModule {}
