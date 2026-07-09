import { randomUUID } from 'node:crypto';
import type { WebhookEventType } from '@eduforge/schemas';
import type {
  CreateDeliveryInput,
  CreateWebhookEndpointInput,
  DeliveryPatch,
  UpdateWebhookEndpointInput,
  WebhookDeliveryRepository,
  WebhookDeliveryRow,
  WebhookEndpointRepository,
  WebhookEndpointRow,
  WebhookEndpointWithSecret,
  WebhookEnqueuer,
  WebhookProjectRepository,
} from '../ports';

export class InMemoryWebhookEndpointRepository implements WebhookEndpointRepository {
  rows: WebhookEndpointWithSecret[] = [];

  async create(input: CreateWebhookEndpointInput): Promise<WebhookEndpointRow> {
    const row: WebhookEndpointWithSecret = {
      id: randomUUID(),
      ownerUserId: input.ownerUserId,
      projectId: input.projectId,
      url: input.url,
      events: input.events,
      active: true,
      createdAt: new Date(),
      secretSealed: input.secretSealed,
    };
    this.rows.push(row);
    // Mesmo contrato do adapter Prisma: create() nunca devolve o segredo selado.
    const { secretSealed, ...view } = row;
    return view;
  }

  async findById(id: string): Promise<WebhookEndpointRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async update(id: string, patch: UpdateWebhookEndpointInput): Promise<WebhookEndpointRow | null> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return null;
    if (patch.url !== undefined) row.url = patch.url;
    if (patch.events !== undefined) row.events = patch.events;
    if (patch.active !== undefined) row.active = patch.active;
    return row;
  }

  async delete(id: string): Promise<void> {
    this.rows = this.rows.filter((r) => r.id !== id);
  }

  async listForOwner(ownerUserId: string): Promise<WebhookEndpointRow[]> {
    return this.rows.filter((r) => r.ownerUserId === ownerUserId);
  }

  async listActiveForEvent(
    ownerUserId: string,
    projectId: string | null,
    event: WebhookEventType,
  ): Promise<WebhookEndpointWithSecret[]> {
    return this.rows.filter(
      (r) =>
        r.ownerUserId === ownerUserId &&
        r.active &&
        r.events.includes(event) &&
        (r.projectId === null || r.projectId === projectId),
    );
  }
}

export class InMemoryWebhookDeliveryRepository implements WebhookDeliveryRepository {
  rows: WebhookDeliveryRow[] = [];

  async create(input: CreateDeliveryInput): Promise<WebhookDeliveryRow> {
    const row: WebhookDeliveryRow = {
      id: randomUUID(),
      endpointId: input.endpointId,
      eventType: input.eventType,
      payload: input.payload,
      status: 'pending',
      attempts: 0,
      responseStatus: null,
      responseBody: null,
      lastAttemptAt: null,
      createdAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }

  async findById(id: string): Promise<WebhookDeliveryRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async update(id: string, patch: DeliveryPatch): Promise<WebhookDeliveryRow> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('not found');
    Object.assign(row, patch);
    return row;
  }

  async listForEndpoint(endpointId: string): Promise<WebhookDeliveryRow[]> {
    return this.rows.filter((r) => r.endpointId === endpointId);
  }
}

export class InMemoryWebhookProjectRepository implements WebhookProjectRepository {
  ownedProjectIds = new Map<string, string>();

  async findByIdForOwner(id: string, ownerUserId: string): Promise<{ id: string } | null> {
    return this.ownedProjectIds.get(id) === ownerUserId ? { id } : null;
  }

  async findOwnerId(projectId: string): Promise<string | null> {
    return this.ownedProjectIds.get(projectId) ?? null;
  }
}

export class InMemoryWebhookEnqueuer implements WebhookEnqueuer {
  calls: Array<{ deliveryId: string; endpointId: string; eventType: string; payload: unknown }> = [];

  async enqueueDelivery(input: {
    deliveryId: string;
    endpointId: string;
    eventType: string;
    payload: unknown;
  }): Promise<void> {
    this.calls.push(input);
  }
}
