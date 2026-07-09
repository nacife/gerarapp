/**
 * Dispara `credits.low_balance` só quando o débito CRUZA o limiar de cima para
 * baixo — não a cada débito com saldo já baixo (evita spam de notificação a
 * cada geração enquanto o saldo não é recarregado). Limiar por usuário fica
 * para quando existir a configuração (Parte 6.B.4: "limiar configurado").
 */
export function crossedLowBalanceThreshold(
  balanceAfter: number,
  debited: number,
  threshold: number,
): boolean {
  return balanceAfter < threshold && balanceAfter + debited >= threshold;
}
