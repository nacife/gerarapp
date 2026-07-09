/** Média móvel exponencial simples: puxa a maestria em direção ao acerto/erro. */
export function updateMastery(prev: number, correct: boolean, weight = 0.3): number {
  const target = correct ? 1 : 0;
  const next = prev * (1 - weight) + target * weight;
  return Math.max(0, Math.min(1, Math.round(next * 100) / 100));
}
