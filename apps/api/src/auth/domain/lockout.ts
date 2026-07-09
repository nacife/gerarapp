import { AUTH } from '@eduforge/config';

/** Snapshot de tentativas de login para uma chave (e-mail/IP). */
export interface AttemptSnapshot {
  failures: number;
  lockedUntil: number | null;
}

export interface LockoutDecision {
  /** CAPTCHA exigido nas próximas tentativas (a partir da 5ª falha). */
  captchaRequired: boolean;
  /** Login bloqueado no momento. */
  locked: boolean;
  /** Segundos até liberar (quando bloqueado). */
  retryAfterSec: number;
}

/**
 * Decisão pura de bloqueio progressivo (Gherkin Épico 5):
 * 5ª falha → CAPTCHA; 10ª falha → bloqueio de 15 min.
 */
export function evaluateLockout(snap: AttemptSnapshot, nowMs: number): LockoutDecision {
  const { lockout } = AUTH;
  if (snap.lockedUntil && snap.lockedUntil > nowMs) {
    return {
      captchaRequired: true,
      locked: true,
      retryAfterSec: Math.ceil((snap.lockedUntil - nowMs) / 1000),
    };
  }
  return {
    captchaRequired: snap.failures >= lockout.captchaThreshold,
    locked: false,
    retryAfterSec: 0,
  };
}

/** Indica se a contagem de falhas atingiu o limiar de bloqueio. */
export function shouldLock(failures: number): boolean {
  return failures >= AUTH.lockout.lockThreshold;
}
