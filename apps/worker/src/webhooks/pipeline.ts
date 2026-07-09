import { buildSignatureHeader } from '@eduforge/schemas/webhooks';
import { decryptSecret, type SealedSecret } from '@eduforge/schemas/crypto';

export interface WebhookDeliveryJobData {
  deliveryId: string;
  endpointId: string;
  eventType: string;
  payload: unknown;
}

export interface WebhookEndpointForDelivery {
  url: string;
  active: boolean;
  secretSealed: SealedSecret;
}

export type WebhookDeliveryStatus = 'success' | 'failed' | 'exhausted';

export interface RecordAttemptInput {
  status: WebhookDeliveryStatus;
  attempts: number;
  responseStatus: number | null;
  responseBody: string | null;
  lastAttemptAt: Date;
}

export interface HttpResponse {
  status: number;
  body: string;
}

export interface WebhookDeliveryPorts {
  getEndpoint(endpointId: string): Promise<WebhookEndpointForDelivery | null>;
  recordAttempt(deliveryId: string, patch: RecordAttemptInput): Promise<void>;
  post(url: string, body: string, headers: Record<string, string>): Promise<HttpResponse>;
  encryptionKey: string;
}

const MAX_RESPONSE_BODY_CHARS = 2000;

/**
 * Entrega assinada de um evento de webhook (Parte 6.B.4): sempre registra a
 * tentativa (sucesso, falha ou esgotada), e só relança para o BullMQ tentar de
 * novo quando ainda restam tentativas — cada falha (rede ou HTTP não-2xx) é
 * tratada da mesma forma para nunca perder o registro da tentativa.
 */
export async function runWebhookDelivery(
  data: WebhookDeliveryJobData,
  attemptsMade: number,
  isFinalAttempt: boolean,
  ports: WebhookDeliveryPorts,
): Promise<void> {
  const attempts = attemptsMade + 1;
  const now = new Date();
  const endpoint = await ports.getEndpoint(data.endpointId);

  if (!endpoint || !endpoint.active) {
    await ports.recordAttempt(data.deliveryId, {
      status: 'exhausted',
      attempts,
      responseStatus: null,
      responseBody: 'Endpoint inativo ou removido.',
      lastAttemptAt: now,
    });
    return;
  }

  const secret = decryptSecret(endpoint.secretSealed, ports.encryptionKey);
  const body = JSON.stringify(data.payload);
  const signature = buildSignatureHeader(secret, body, now);

  let result: { status: number | null; body: string; ok: boolean };
  try {
    const res = await ports.post(endpoint.url, body, {
      'content-type': 'application/json',
      'x-eduforge-signature': signature,
      'x-eduforge-event': data.eventType,
    });
    result = {
      status: res.status,
      body: res.body.slice(0, MAX_RESPONSE_BODY_CHARS),
      ok: res.status >= 200 && res.status < 300,
    };
  } catch (err) {
    result = { status: null, body: err instanceof Error ? err.message : String(err), ok: false };
  }

  await ports.recordAttempt(data.deliveryId, {
    status: result.ok ? 'success' : isFinalAttempt ? 'exhausted' : 'failed',
    attempts,
    responseStatus: result.status,
    responseBody: result.body,
    lastAttemptAt: now,
  });

  if (!result.ok) {
    throw new Error(`webhook delivery failed: ${result.status ?? 'network error'} — ${data.eventType} → ${endpoint.url}`);
  }
}
