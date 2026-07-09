import { describe, expect, it } from 'vitest';
import { computeProgress } from './progress';

describe('computeProgress', () => {
  it('calcula o percentual e arredonda', () => {
    expect(computeProgress(3, 5)).toBe(60);
    expect(computeProgress(1, 3)).toBe(33);
  });

  it('trata total zero sem quebrar', () => {
    expect(computeProgress(0, 0)).toBe(0);
  });

  it('limita a faixa 0..100', () => {
    expect(computeProgress(10, 5)).toBe(100);
    expect(computeProgress(-1, 5)).toBe(0);
  });
});
