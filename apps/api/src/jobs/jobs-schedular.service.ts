import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class JobsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(JobsSchedulerService.name);

  constructor(
    @InjectQueue('expiry-sweep') private readonly expiryQueue: Queue,
    @InjectQueue('projection-rebuild') private readonly rebuildQueue: Queue,
  ) {}

  onModuleInit() {
    this.logger.log('Jobs scheduler ready (batch expiry monitoring at 00:10 Africa/Nairobi)');
  }

  @Cron('0 10 0 * * *', { timeZone: 'Africa/Nairobi' })
  async enqueueExpirySweep() {
    this.logger.log('Enqueueing expiry-sweep job…');
    await this.expiryQueue.add(
      'sweep',
      { shopId: '1', triggeredAt: new Date().toISOString() },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );
  }

  async enqueueFullRebuild(shopId = '1') {
    await this.rebuildQueue.add(
      'rebuild-all',
      { shopId },
      { removeOnComplete: true, attempts: 1 },
    );
  }
}