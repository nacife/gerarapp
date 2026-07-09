import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUES } from '@eduforge/config';
import type { DeletionEnqueuer } from '../ports';

/** Enfileira a anonimização de conta (LGPD) para o worker processar. */
export class BullMqDeletionEnqueuer implements DeletionEnqueuer {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(QUEUES.anonymize, { connection });
  }

  async enqueueAnonymizeUser(userId: string): Promise<void> {
    await this.queue.add(
      'anonymize-user',
      { userId },
      { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
  }
}
