/**
 * Catálogo de eventos, tipos e funções puras de webhooks (Parte 6.B.4).
 * Compatível com browser e Node.js — NÃO usa 'node:crypto'.
 * Funções de assinatura HMAC estão em 'webhooks.signing.ts' (Node.js only).
 */

export const WEBHOOK_EVENT_TYPES = [
  'ingest.completed',
  'ingest.failed',
  'interactions.generated',
  'app.published',
  'app.rolled_back',
  'learner.enrolled',
  'learner.completed',
  'learning.milestone',
  'certificate.issued',
  'inpi.package.ready',
  'inpi.filing.status_changed',
  'credits.low_balance',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export function isValidWebhookEvent(value: string): value is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}

export interface WebhookEventPayload<T = unknown> {
  id: string;
  event: WebhookEventType;
  occurred_at: string;
  data: T;
}

/** Envelope padrão (Parte 6.B.4): `{ id, event, occurred_at, data }`. */
export function buildWebhookEventPayload<T>(
  event: WebhookEventType,
  data: T,
  now: Date = new Date(),
): WebhookEventPayload<T> {
  return {
    id: `evt_${globalThis.crypto.randomUUID()}`,
    event,
    occurred_at: now.toISOString(),
    data,
  };
}

export interface ParsedSignature {
  timestamp: number;
  signature: string;
}

export function parseSignatureHeader(header: string): ParsedSignature | null {
  const parts: Record<string, string> = {};
  for (const kv of header.split(',')) {
    const [key, value] = kv.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  }
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return null;
  return { timestamp, signature };
}

/** 13 tentativas (exponencial de 1min, cap de 4h) somam ~24,25h. */
export const WEBHOOK_MAX_ATTEMPTS = 13;
const WEBHOOK_BACKOFF_BASE_MS = 60_000;
const WEBHOOK_BACKOFF_CAP_MS = 4 * 60 * 60_000;

/** Estratégia de backoff custom do BullMQ — exponencial com cap. */
export function computeWebhookBackoffMs(attemptsMade: number): number {
  return Math.min(WEBHOOK_BACKOFF_BASE_MS * 2 ** (attemptsMade - 1), WEBHOOK_BACKOFF_CAP_MS);
}
