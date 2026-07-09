import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUES } from '@eduforge/config';
import type { InteractionType } from '@eduforge/schemas';
import type { GenerateEnqueuer } from '../ports';

export class BullMqGenerateEnqueuer implements GenerateEnqueuer {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(QUEUES.generate, { connection });
  }

  async enqueueGenerate(input: {
    jobId: string;
    projectId: string;
    ownerUserId: string;
    density: 'light' | 'balanced' | 'intensive';
    types?: InteractionType[];
  }): Promise<void> {
    // attempts:1 — o pipeline já faz retries internos; evita débito duplicado.
    await this.queue.add('generate', input, { removeOnComplete: 100, attempts: 1 });
  }
}
