import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUES } from '@eduforge/config';
import type { SenseiEmbedEnqueuer } from '../ports';

export class BullMqSenseiEmbedEnqueuer implements SenseiEmbedEnqueuer {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(QUEUES.senseiEmbed, { connection });
  }

  async enqueueEmbed(projectId: string): Promise<void> {
    await this.queue.add('embed', { projectId }, { removeOnComplete: 100, removeOnFail: 100 });
  }
}
