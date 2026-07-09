/**
 * Catálogo de eventos e assinatura HMAC de webhooks (Parte 6.B.4).
 * Puro: compartilhado entre `apps/api` (CRUD dos endpoints, enfileira entregas)
 * e `apps/worker` (worker de entrega assina e envia o POST) — pacotes não podem
 * depender de apps, então a lógica mora aqui (mesmo padrão de `inpi-metadata.ts`).
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

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
    id: `evt_${randomUUID()}`,
    event,
    occurred_at: now.toISOString(),
    data,
  };
}

/** Comparação em tempo constante — cópia local de `auth/domain/crypto.ts` (fronteira de pacote). */
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export interface ParsedSignature {
  timestamp: number;
  signature: string;
}

function computeHmac(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Monta `X-EduForge-Signature: t=<ts>,v1=<hmac_sha256>` (Parte 6.B.4). */
export function buildSignatureHeader(secret: string, body: string, now: Date = new Date()): string {
  const timestamp = Math.floor(now.getTime() / 1000);
  return `t=${timestamp},v1=${computeHmac(secret, timestamp, body)}`;
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

const DEFAULT_TOLERANCE_SECONDS = 300;

/** Verifica assinatura + janela anti-replay de 5 min (Parte 6.B.4). */
export function verifyWebhookSignature(
  secret: string,
  header: string,
  body: string,
  now: Date = new Date(),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) return false;
  return safeEqualHex(computeHmac(secret, parsed.timestamp, body), parsed.signature);
}

/** 13 tentativas (exponencial de 1min, cap de 4h) somam ~24,25h — Parte 6.B.4: "retry exponencial por 24h". */
export const WEBHOOK_MAX_ATTEMPTS = 13;
const WEBHOOK_BACKOFF_BASE_MS = 60_000;
const WEBHOOK_BACKOFF_CAP_MS = 4 * 60 * 60_000;

/** Estratégia de backoff custom do BullMQ (worker) — exponencial com cap. */
export function computeWebhookBackoffMs(attemptsMade: number): number {
  return Math.min(WEBHOOK_BACKOFF_BASE_MS * 2 ** (attemptsMade - 1), WEBHOOK_BACKOFF_CAP_MS);
}
