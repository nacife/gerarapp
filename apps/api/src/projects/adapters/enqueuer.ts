import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUES } from '@eduforge/config';
import type { IngestEnqueuer } from '../ports';

export class BullMqIngestEnqueuer implements IngestEnqueuer {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(QUEUES.ingest, { connection });
  }

  async enqueueIngest(input: {
    jobId: string;
    sourceFileId: string;
    projectId: string;
  }): Promise<void> {
    await this.queue.add('ingest', input, {
      removeOnComplete: 100,
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
}
