import { describe, expect, it } from 'vitest';
import { computePricing } from './pricing';

describe('computePricing', () => {
  it('decompõe honorários e GRU, somando o total', () => {
    const p = computePricing(29700, 21000);
    expect(p.serviceFeeCents).toBe(29700);
    expect(p.gruFeeCents).toBe(21000);
    expect(p.totalCents).toBe(50700);
  });
});
