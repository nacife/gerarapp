import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUES } from '@eduforge/config';
import type { MediaJobEnqueuer } from '../ports';

export class BullMqTtsEnqueuer implements MediaJobEnqueuer {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(QUEUES.tts, { connection });
  }

  async enqueueTts(data: {
    jobId: string;
    projectId: string;
    chapterId: string;
    appTitle: string;
  }): Promise<void> {
    await this.queue.add('podcast', data, { removeOnComplete: 100, removeOnFail: 100 });
  }
}
