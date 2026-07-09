import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUES } from '@eduforge/config';
import type { InpiEnqueuer } from '../ports';

export class BullMqInpiEnqueuer implements InpiEnqueuer {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(QUEUES.inpiPackage, { connection });
  }

  async enqueuePackage(input: { jobId: string; appVersionId: string; requestedById: string }): Promise<void> {
    await this.queue.add('inpi-package', input, { removeOnComplete: 100, attempts: 1 });
  }
}
