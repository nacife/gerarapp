/** Percentual de progresso (0..100), robusto a divisões por zero e overflow. */
export function computeProgress(completed: number, total: number): number {
  if (total <= 0) return 0;
  const pct = (completed / total) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
