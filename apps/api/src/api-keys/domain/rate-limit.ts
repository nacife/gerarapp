export interface RateLimitWindow {
  /** Chave Redis do contador da janela corrente. */
  windowKey: string;
  limit: number;
  resetAt: Date;
}

const WINDOW_MS = 60_000;

/** Janela fixa de 1 min por chave (Parte 6.B.1: 120 req/min). Puro — o INCR/EXPIRE fica no adapter Redis. */
export function computeRateLimitWindow(apiKeyId: string, limit: number, now: Date): RateLimitWindow {
  const windowStartMs = Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS;
  return {
    windowKey: `ratelimit:${apiKeyId}:${windowStartMs}`,
    limit,
    resetAt: new Date(windowStartMs + WINDOW_MS),
  };
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/** Decide a partir da contagem já incrementada pelo adapter (count inclui a requisição atual). */
export function evaluateRateLimit(window: RateLimitWindow, count: number): RateLimitDecision {
  return {
    allowed: count <= window.limit,
    remaining: Math.max(0, window.limit - count),
    resetAt: window.resetAt,
  };
}
