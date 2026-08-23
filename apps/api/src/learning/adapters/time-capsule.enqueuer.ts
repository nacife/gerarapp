import { Queue } from 'bullmq';
import { QUEUES } from '@eduforge/config';
import type { TimeCapsuleEnqueuer } from '../ports';

export class BullMqTimeCapsuleEnqueuer implements TimeCapsuleEnqueuer {
  private readonly queue: Queue;

  constructor(connection: any) {
    this.queue = new Queue(QUEUES.timeCapsule, { connection });
  }

  async enqueue(input: {
    capsuleId: string;
    learnerEmail: string;
    message: string;
    delayMs: number;
  }): Promise<void> {
    await this.queue.add('send', input, {
      jobId: `capsule-${input.capsuleId}`,
      delay: input.delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
