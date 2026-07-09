import { describe, expect, it } from 'vitest';
import {
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_MAX_ATTEMPTS,
  buildWebhookEventPayload,
  computeWebhookBackoffMs,
  isValidWebhookEvent,
  parseSignatureHeader,
} from './webhooks';
import { buildSignatureHeader, verifyWebhookSignature } from './webhooks.signing';

describe('WEBHOOK_EVENT_TYPES', () => {
  it('tem os 12 tipos de evento documentados (Parte 6.B.4)', () => {
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(12);
  });

  it('não tem duplicatas', () => {
    expect(new Set(WEBHOOK_EVENT_TYPES).size).toBe(WEBHOOK_EVENT_TYPES.length);
  });
});

describe('isValidWebhookEvent', () => {
  it('aceita todo evento do catálogo', () => {
    for (const event of WEBHOOK_EVENT_TYPES) expect(isValidWebhookEvent(event)).toBe(true);
  });

  it('rejeita evento inventado', () => {
    expect(isValidWebhookEvent('project.deleted')).toBe(false);
  });
});

describe('buildWebhookEventPayload', () => {
  it('monta o envelope padrão { id, event, occurred_at, data }', () => {
    const now = new Date('2026-07-08T10:00:00.000Z');
    const payload = buildWebhookEventPayload('app.published', { version: 1 }, now);
    expect(payload.id.startsWith('evt_')).toBe(true);
    expect(payload.event).toBe('app.published');
    expect(payload.occurred_at).toBe('2026-07-08T10:00:00.000Z');
    expect(payload.data).toEqual({ version: 1 });
  });

  it('cada chamada gera um id único', () => {
    const a = buildWebhookEventPayload('app.published', {});
    const b = buildWebhookEventPayload('app.published', {});
    expect(a.id).not.toBe(b.id);
  });
});

const SECRET = 'whsec_test_segredo';
const BODY = JSON.stringify({ id: 'evt_1', event: 'app.published', data: {} });

describe('buildSignatureHeader / parseSignatureHeader', () => {
  it('formata como t=<ts>,v1=<hmac>', () => {
    const header = buildSignatureHeader(SECRET, BODY, new Date('2026-07-08T10:00:00.000Z'));
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('parseia de volta timestamp e assinatura', () => {
    const header = buildSignatureHeader(SECRET, BODY, new Date('2026-07-08T10:00:00.000Z'));
    const parsed = parseSignatureHeader(header);
    expect(parsed?.timestamp).toBe(1783504800);
    expect(parsed?.signature).toHaveLength(64);
  });

  it('header malformado não parseia', () => {
    expect(parseSignatureHeader('garbage')).toBeNull();
    expect(parseSignatureHeader('t=abc,v1=xyz')).toBeNull();
  });
});

describe('verifyWebhookSignature', () => {
  it('aceita assinatura válida dentro da tolerância', () => {
    const now = new Date('2026-07-08T10:00:00.000Z');
    const header = buildSignatureHeader(SECRET, BODY, now);
    expect(verifyWebhookSignature(SECRET, header, BODY, now)).toBe(true);
  });

  it('rejeita quando o secret não confere', () => {
    const now = new Date('2026-07-08T10:00:00.000Z');
    const header = buildSignatureHeader(SECRET, BODY, now);
    expect(verifyWebhookSignature('outro-secret', header, BODY, now)).toBe(false);
  });

  it('rejeita quando o corpo foi alterado (payload tampering)', () => {
    const now = new Date('2026-07-08T10:00:00.000Z');
    const header = buildSignatureHeader(SECRET, BODY, now);
    expect(verifyWebhookSignature(SECRET, header, BODY + 'x', now)).toBe(false);
  });

  it('rejeita fora da janela de tolerância (replay)', () => {
    const signedAt = new Date('2026-07-08T10:00:00.000Z');
    const header = buildSignatureHeader(SECRET, BODY, signedAt);
    const sixMinutesLater = new Date(signedAt.getTime() + 6 * 60_000);
    expect(verifyWebhookSignature(SECRET, header, BODY, sixMinutesLater)).toBe(false);
  });

  it('aceita bem no limite da tolerância padrão de 5 min', () => {
    const signedAt = new Date('2026-07-08T10:00:00.000Z');
    const header = buildSignatureHeader(SECRET, BODY, signedAt);
    const fourMin59 = new Date(signedAt.getTime() + 4 * 60_000 + 59_000);
    expect(verifyWebhookSignature(SECRET, header, BODY, fourMin59)).toBe(true);
  });

  it('header ausente/vazio nunca verifica', () => {
    expect(verifyWebhookSignature(SECRET, '', BODY)).toBe(false);
  });
});

describe('computeWebhookBackoffMs', () => {
  it('dobra a cada tentativa até o cap de 4h', () => {
    expect(computeWebhookBackoffMs(1)).toBe(60_000);
    expect(computeWebhookBackoffMs(2)).toBe(120_000);
    expect(computeWebhookBackoffMs(3)).toBe(240_000);
    expect(computeWebhookBackoffMs(8)).toBe(7_680_000);
  });

  it('satura em 4h a partir da 9ª tentativa', () => {
    const cap = 4 * 60 * 60_000;
    expect(computeWebhookBackoffMs(9)).toBe(cap);
    expect(computeWebhookBackoffMs(13)).toBe(cap);
    expect(computeWebhookBackoffMs(30)).toBe(cap);
  });

  it('a soma de WEBHOOK_MAX_ATTEMPTS tentativas cobre ~24h (Parte 6.B.4)', () => {
    let totalMs = 0;
    for (let attempt = 1; attempt < WEBHOOK_MAX_ATTEMPTS; attempt++) {
      totalMs += computeWebhookBackoffMs(attempt);
    }
    const totalHours = totalMs / 3_600_000;
    expect(totalHours).toBeGreaterThan(20);
    expect(totalHours).toBeLessThan(28);
  });
});
