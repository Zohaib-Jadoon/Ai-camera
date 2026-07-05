import { Module } from '@nestjs/common';
import { AlertRulesService } from './alert-rules.service';
import { AlertRulesController } from './alert-rules.controller';

@Module({
  controllers: [AlertRulesController],
  providers: [AlertRulesService],
})
export class AlertRulesModule {}
