import { describe, expect, it } from 'vitest';
import { crossedLowBalanceThreshold } from './low-balance';

describe('crossedLowBalanceThreshold', () => {
  it('dispara quando o débito cruza o limiar (de >= para <)', () => {
    // saldo era 32, debitou 6 → 26 (limiar 30): cruzou
    expect(crossedLowBalanceThreshold(26, 6, 30)).toBe(true);
  });

  it('não dispara quando o saldo continua acima do limiar', () => {
    // saldo era 100, debitou 6 → 94
    expect(crossedLowBalanceThreshold(94, 6, 30)).toBe(false);
  });

  it('não dispara de novo em débitos já abaixo do limiar', () => {
    // saldo era 20, debitou 6 → 14: já estava abaixo, não é travessia
    expect(crossedLowBalanceThreshold(14, 6, 30)).toBe(false);
  });

  it('cair exatamente para o limiar não dispara (limiar é "abaixo de")', () => {
    // saldo era 36, debitou 6 → 30: 30 não é < 30
    expect(crossedLowBalanceThreshold(30, 6, 30)).toBe(false);
  });

  it('sair exatamente do limiar dispara', () => {
    // saldo era 30, debitou 1 → 29
    expect(crossedLowBalanceThreshold(29, 1, 30)).toBe(true);
  });
});
