import { Prisma, prisma } from '@eduforge/db';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUES } from '@eduforge/config';
import { WEBHOOK_MAX_ATTEMPTS, buildWebhookEventPayload, type WebhookEventType } from '@eduforge/schemas';

export interface WebhookNotifier {
  dispatch(ownerUserId: string, projectId: string | null, event: WebhookEventType, data: unknown): Promise<void>;
  dispatchForProject(projectId: string, event: WebhookEventType, data: unknown): Promise<void>;
}

/**
 * Fan-out dos eventos disparados pelo worker (ingest, generate, inpi-package) —
 * espelho do `WebhooksService.dispatch` da api (mesma consulta, mesmas opções de
 * job). Best-effort: falha ao notificar nunca derruba o job de negócio.
 */
export class BullMqWebhookNotifier implements WebhookNotifier {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(QUEUES.webhookDelivery, { connection });
  }

  async dispatch(
    ownerUserId: string,
    projectId: string | null,
    event: WebhookEventType,
    data: unknown,
  ): Promise<void> {
    try {
      const targets = await prisma.webhookEndpoint.findMany({
        where: {
          ownerUserId,
          active: true,
          events: { has: event },
          OR: projectId === null ? [{ projectId: null }] : [{ projectId: null }, { projectId }],
        },
        select: { id: true },
      });
      if (targets.length === 0) return;

      const payload = buildWebhookEventPayload(event, data);
      await Promise.all(
        targets.map(async (target) => {
          const delivery = await prisma.webhookDelivery.create({
            data: {
              endpointId: target.id,
              eventType: event,
              payload: payload as unknown as Prisma.InputJsonValue,
            },
          });
          await this.queue.add(
            'deliver',
            { deliveryId: delivery.id, endpointId: target.id, eventType: event, payload },
            {
              jobId: delivery.id,
              attempts: WEBHOOK_MAX_ATTEMPTS,
              backoff: { type: 'custom' },
              removeOnComplete: 500,
              removeOnFail: 500,
            },
          );
        }),
      );
    } catch {
      // best-effort
    }
  }

  async dispatchForProject(projectId: string, event: WebhookEventType, data: unknown): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerUserId: true },
      });
      if (!project) return;
      await this.dispatch(project.ownerUserId, projectId, event, data);
    } catch {
      // best-effort
    }
  }
}
