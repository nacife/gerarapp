import { describe, expect, it } from 'vitest';
import { computeRateLimitWindow, evaluateRateLimit } from './rate-limit';

describe('computeRateLimitWindow', () => {
  it('duas datas no mesmo minuto caem na mesma janela', () => {
    const a = computeRateLimitWindow('key-1', 120, new Date('2026-07-08T10:00:00.100Z'));
    const b = computeRateLimitWindow('key-1', 120, new Date('2026-07-08T10:00:59.900Z'));
    expect(a.windowKey).toBe(b.windowKey);
    expect(a.resetAt.toISOString()).toBe(b.resetAt.toISOString());
  });

  it('minutos diferentes caem em janelas diferentes', () => {
    const a = computeRateLimitWindow('key-1', 120, new Date('2026-07-08T10:00:59.999Z'));
    const b = computeRateLimitWindow('key-1', 120, new Date('2026-07-08T10:01:00.000Z'));
    expect(a.windowKey).not.toBe(b.windowKey);
  });

  it('chaves diferentes nunca compartilham janela', () => {
    const now = new Date('2026-07-08T10:00:00.000Z');
    const a = computeRateLimitWindow('key-1', 120, now);
    const b = computeRateLimitWindow('key-2', 120, now);
    expect(a.windowKey).not.toBe(b.windowKey);
  });

  it('resetAt cai no início do próximo minuto', () => {
    const w = computeRateLimitWindow('key-1', 120, new Date('2026-07-08T10:00:30.000Z'));
    expect(w.resetAt.toISOString()).toBe('2026-07-08T10:01:00.000Z');
  });
});

describe('evaluateRateLimit', () => {
  const window = computeRateLimitWindow('key-1', 120, new Date('2026-07-08T10:00:00.000Z'));

  it('permite enquanto count <= limit', () => {
    expect(evaluateRateLimit(window, 1).allowed).toBe(true);
    expect(evaluateRateLimit(window, 120).allowed).toBe(true);
  });

  it('bloqueia quando count excede o limit', () => {
    expect(evaluateRateLimit(window, 121).allowed).toBe(false);
  });

  it('remaining nunca fica negativo', () => {
    expect(evaluateRateLimit(window, 200).remaining).toBe(0);
  });

  it('remaining reflete o quanto ainda cabe na janela', () => {
    expect(evaluateRateLimit(window, 100).remaining).toBe(20);
  });
});
