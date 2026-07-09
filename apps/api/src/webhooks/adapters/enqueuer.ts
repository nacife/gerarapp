import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUES } from '@eduforge/config';
import { WEBHOOK_MAX_ATTEMPTS } from '@eduforge/schemas';
import type { WebhookEnqueuer } from '../ports';

export class BullMqWebhookEnqueuer implements WebhookEnqueuer {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(QUEUES.webhookDelivery, { connection });
  }

  async enqueueDelivery(input: {
    deliveryId: string;
    endpointId: string;
    eventType: string;
    payload: unknown;
  }): Promise<void> {
    await this.queue.add('deliver', input, {
      jobId: input.deliveryId,
      attempts: WEBHOOK_MAX_ATTEMPTS,
      backoff: { type: 'custom' },
      removeOnComplete: 500,
      removeOnFail: 500,
    });
  }
}
