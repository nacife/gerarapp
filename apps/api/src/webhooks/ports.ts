import type { WebhookEventType } from '@eduforge/schemas';
import type { SealedSecret } from '../auth/domain/crypto';

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'exhausted';

export interface WebhookEndpointRow {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  url: string;
  events: string[];
  active: boolean;
  createdAt: Date;
}

export interface WebhookEndpointWithSecret extends WebhookEndpointRow {
  secretSealed: SealedSecret;
}

export interface CreateWebhookEndpointInput {
  ownerUserId: string;
  projectId: string | null;
  url: string;
  events: string[];
  secretSealed: SealedSecret;
}

export interface UpdateWebhookEndpointInput {
  url?: string;
  events?: string[];
  active?: boolean;
}

export interface WebhookEndpointRepository {
  create(input: CreateWebhookEndpointInput): Promise<WebhookEndpointRow>;
  findById(id: string): Promise<WebhookEndpointRow | null>;
  update(id: string, patch: UpdateWebhookEndpointInput): Promise<WebhookEndpointRow | null>;
  delete(id: string): Promise<void>;
  listForOwner(ownerUserId: string): Promise<WebhookEndpointRow[]>;
  /** Endpoints ativos inscritos no evento, escopados à conta e (se houver) ao projeto — usado no dispatch. */
  listActiveForEvent(ownerUserId: string, projectId: string | null, event: WebhookEventType): Promise<WebhookEndpointWithSecret[]>;
}

export interface WebhookDeliveryRow {
  id: string;
  endpointId: string;
  eventType: string;
  payload: unknown;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseStatus: number | null;
  responseBody: string | null;
  lastAttemptAt: Date | null;
  createdAt: Date;
}

export interface CreateDeliveryInput {
  endpointId: string;
  eventType: string;
  payload: unknown;
}

export interface DeliveryPatch {
  status?: WebhookDeliveryStatus;
  attempts?: number;
  responseStatus?: number | null;
  responseBody?: string | null;
  lastAttemptAt?: Date;
}

export interface WebhookDeliveryRepository {
  create(input: CreateDeliveryInput): Promise<WebhookDeliveryRow>;
  findById(id: string): Promise<WebhookDeliveryRow | null>;
  update(id: string, patch: DeliveryPatch): Promise<WebhookDeliveryRow>;
  listForEndpoint(endpointId: string, limit?: number): Promise<WebhookDeliveryRow[]>;
}

export interface WebhookEnqueuer {
  enqueueDelivery(input: {
    deliveryId: string;
    endpointId: string;
    eventType: string;
    payload: unknown;
    attempt?: number;
  }): Promise<void>;
}

/** Porta mínima para validar que um projeto pertence ao dono antes de escopar um endpoint. */
export interface WebhookProjectRepository {
  findByIdForOwner(id: string, ownerUserId: string): Promise<{ id: string } | null>;
  /** Resolve o dono a partir do projeto — usado nos pontos de disparo iniciados por quem não é o dono (aprendiz, operador). */
  findOwnerId(projectId: string): Promise<string | null>;
}
