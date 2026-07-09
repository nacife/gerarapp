export type CheckStatus = 'up' | 'down';

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  checks: Record<string, CheckStatus>;
}

/** Cliente mínimo necessário para checar o banco (facilita o teste). */
export interface PingableDb {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
}

/**
 * Lógica pura de readiness (sem decorators) — testável isoladamente.
 * Verifica a conectividade com o banco; degradado se qualquer check falhar.
 */
export async function checkReadiness(db: PingableDb): Promise<ReadinessReport> {
  const checks: Record<string, CheckStatus> = {};
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = 'up';
  } catch {
    checks.database = 'down';
  }
  const status = Object.values(checks).every((v) => v === 'up') ? 'ok' : 'degraded';
  return { status, checks };
}
