/** Data (YYYY-MM-DD, UTC) de um instante — base do cálculo de streak. */
export function toDateIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
