import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CreditService } from './credit.service';
import {
  SyncTokenCreditUsageJobData,
  SyncMediaCreditUsageJobData,
  SyncBatchTokenCreditUsageJobData,
} from './credit.dto';
import { QUEUE_SYNC_TOKEN_CREDIT_USAGE, QUEUE_SYNC_MEDIA_CREDIT_USAGE } from '../../utils/const';

@Processor(QUEUE_SYNC_TOKEN_CREDIT_USAGE)
export class SyncTokenCreditUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncTokenCreditUsageProcessor.name);

  constructor(private creditService: CreditService) {
    super();
  }

  async process(job: Job<SyncTokenCreditUsageJobData | SyncBatchTokenCreditUsageJobData>) {
    this.logger.log(`[${QUEUE_SYNC_TOKEN_CREDIT_USAGE}] job: ${JSON.stringify(job)}`);
    try {
      // Check if this is a batch job or single job
      if ('usages' in job.data) {
        // This is a batch job
        await this.creditService.syncBatchTokenCreditUsage(
          job.data as SyncBatchTokenCreditUsageJobData,
        );
      } else {
        // This is a single job
        await this.creditService.syncTokenCreditUsage(job.data as SyncTokenCreditUsageJobData);
      }
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_TOKEN_CREDIT_USAGE}] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_SYNC_MEDIA_CREDIT_USAGE)
export class SyncMediaCreditUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncMediaCreditUsageProcessor.name);

  constructor(private creditService: CreditService) {
    super();
  }

  async process(job: Job<SyncMediaCreditUsageJobData>) {
    this.logger.log(`[${QUEUE_SYNC_MEDIA_CREDIT_USAGE}] job: ${JSON.stringify(job)}`);
    try {
      await this.creditService.syncMediaCreditUsage(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_MEDIA_CREDIT_USAGE}] error: ${error?.stack}`);
      throw error;
    }
  }
}
