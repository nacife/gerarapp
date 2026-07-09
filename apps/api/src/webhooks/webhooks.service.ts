import { buildWebhookEventPayload, type WebhookEventType } from '@eduforge/schemas';
import { encryptSecret } from '../auth/domain/crypto';
import { Errors } from '../common/errors';
import type {
  WebhookDeliveryRepository,
  WebhookDeliveryRow,
  WebhookEndpointRepository,
  WebhookEndpointRow,
  WebhookEnqueuer,
  WebhookProjectRepository,
} from './ports';

export interface CreateWebhookEndpointRequest {
  url: string;
  events: string[];
  secret: string;
  projectId?: string | null;
}

export interface UpdateWebhookEndpointRequest {
  url?: string;
  events?: string[];
  active?: boolean;
}

export class WebhooksService {
  constructor(
    private readonly endpoints: WebhookEndpointRepository,
    private readonly deliveries: WebhookDeliveryRepository,
    private readonly projects: WebhookProjectRepository,
    private readonly enqueuer: WebhookEnqueuer,
    private readonly encryptionKey: string,
  ) {}

  async create(ownerUserId: string, input: CreateWebhookEndpointRequest): Promise<WebhookEndpointRow> {
    if (input.projectId) {
      const project = await this.projects.findByIdForOwner(input.projectId, ownerUserId);
      if (!project) throw Errors.notFound('Projeto');
    }
    return this.endpoints.create({
      ownerUserId,
      projectId: input.projectId ?? null,
      url: input.url,
      events: input.events,
      secretSealed: encryptSecret(input.secret, this.encryptionKey),
    });
  }

  list(ownerUserId: string): Promise<WebhookEndpointRow[]> {
    return this.endpoints.listForOwner(ownerUserId);
  }

  async update(ownerUserId: string, id: string, patch: UpdateWebhookEndpointRequest): Promise<WebhookEndpointRow> {
    const endpoint = await this.requireOwned(ownerUserId, id);
    const updated = await this.endpoints.update(endpoint.id, patch);
    if (!updated) throw Errors.notFound('Webhook');
    return updated;
  }

  async remove(ownerUserId: string, id: string): Promise<void> {
    await this.requireOwned(ownerUserId, id);
    await this.endpoints.delete(id);
  }

  async listDeliveries(ownerUserId: string, endpointId: string): Promise<WebhookDeliveryRow[]> {
    await this.requireOwned(ownerUserId, endpointId);
    return this.deliveries.listForEndpoint(endpointId);
  }

  /** Reenfileira a mesma entrega (payload original) — "painel de reentrega manual" (Parte 6.B.4). */
  async redeliver(ownerUserId: string, deliveryId: string): Promise<WebhookDeliveryRow> {
    const original = await this.deliveries.findById(deliveryId);
    if (!original) throw Errors.notFound('Entrega');
    await this.requireOwned(ownerUserId, original.endpointId);

    const retry = await this.deliveries.create({
      endpointId: original.endpointId,
      eventType: original.eventType,
      payload: original.payload,
    });
    await this.enqueuer.enqueueDelivery({
      deliveryId: retry.id,
      endpointId: original.endpointId,
      eventType: original.eventType,
      payload: original.payload,
    });
    return retry;
  }

  /**
   * Fan-out: cria uma entrega + enfileira para cada endpoint ativo inscrito no
   * evento (conta inteira ou escopado ao projeto). Chamado pelos pontos de
   * disparo dos 9 eventos (Parte 6.B.4) — nunca lança, best-effort: o disparo
   * de webhook não pode derrubar a ação de negócio que o originou.
   */
  async dispatch(
    ownerUserId: string,
    projectId: string | null,
    event: WebhookEventType,
    data: unknown,
  ): Promise<void> {
    try {
      const targets = await this.endpoints.listActiveForEvent(ownerUserId, projectId, event);
      if (targets.length === 0) return;

      const payload = buildWebhookEventPayload(event, data);

      await Promise.all(
        targets.map(async (endpoint) => {
          const delivery = await this.deliveries.create({
            endpointId: endpoint.id,
            eventType: event,
            payload,
          });
          await this.enqueuer.enqueueDelivery({
            deliveryId: delivery.id,
            endpointId: endpoint.id,
            eventType: event,
            payload,
          });
        }),
      );
    } catch {
      // best-effort — falha ao notificar webhooks não pode reverter/derrubar a ação de negócio
    }
  }

  /** Mesmo fan-out de {@link dispatch}, mas resolve o dono a partir do projeto (chamado por aprendiz/operador, não pelo dono). */
  async dispatchForProject(projectId: string, event: WebhookEventType, data: unknown): Promise<void> {
    try {
      const ownerUserId = await this.projects.findOwnerId(projectId);
      if (!ownerUserId) return;
      await this.dispatch(ownerUserId, projectId, event, data);
    } catch {
      // best-effort
    }
  }

  private async requireOwned(ownerUserId: string, id: string): Promise<WebhookEndpointRow> {
    const endpoint = await this.endpoints.findById(id);
    if (!endpoint || endpoint.ownerUserId !== ownerUserId) throw Errors.notFound('Webhook');
    return endpoint;
  }
}
