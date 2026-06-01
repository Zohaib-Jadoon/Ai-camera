import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecordingService } from './recording.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RecordingScheduler {
  private readonly logger = new Logger(RecordingScheduler.name);

  constructor(
    private readonly recordingService: RecordingService,
    private readonly configService: ConfigService,
  ) { }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldRecordings() {
    const retentionDays = this.configService.get<number>('RECORDING_RETENTION_DAYS', 30);
    this.logger.log(`Starting daily recording purge (retention: ${retentionDays} days)`);
    try {
      await this.recordingService.purgeOldClips(retentionDays);
      this.logger.log('Recording purge completed');
    } catch (err) {
      this.logger.error(`Recording purge failed: ${err.message}`);
    }
  }
}
