/**
 * Assinatura e verificação HMAC de webhooks (Node.js only — usa 'node:crypto').
 * NÃO importe este módulo em código de browser.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseSignatureHeader } from './webhooks';

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function computeHmac(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function buildSignatureHeader(secret: string, body: string, now: Date = new Date()): string {
  const timestamp = Math.floor(now.getTime() / 1000);
  return `t=${timestamp},v1=${computeHmac(secret, timestamp, body)}`;
}

const DEFAULT_TOLERANCE_SECONDS = 300;

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
