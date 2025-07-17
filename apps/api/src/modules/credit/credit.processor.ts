import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CreditService } from './credit.service';
import { SyncTokenCreditUsageJobData } from './credit.dto';
import { QUEUE_SYNC_TOKEN_CREDIT_USAGE } from '../../utils/const';

@Processor(QUEUE_SYNC_TOKEN_CREDIT_USAGE)
export class SyncTokenCreditUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncTokenCreditUsageProcessor.name);

  constructor(private creditService: CreditService) {
    super();
  }

  async process(job: Job<SyncTokenCreditUsageJobData>) {
    console.log('SyncTokenCreditUsageProcessor', job.data);
    this.logger.log(`[${QUEUE_SYNC_TOKEN_CREDIT_USAGE}] job: ${JSON.stringify(job)}`);
    try {
      await this.creditService.syncTokenCreditUsage(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_TOKEN_CREDIT_USAGE}] error: ${error?.stack}`);
      throw error;
    }
  }
}
