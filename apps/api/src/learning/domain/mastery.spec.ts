import { describe, expect, it } from 'vitest';
import { updateMastery } from './mastery';

describe('updateMastery', () => {
  it('acertos sucessivos puxam a maestria para 1', () => {
    let m = 0;
    for (let i = 0; i < 20; i++) m = updateMastery(m, true);
    expect(m).toBeGreaterThan(0.95);
  });

  it('erros sucessivos puxam a maestria para 0', () => {
    let m = 1;
    for (let i = 0; i < 20; i++) m = updateMastery(m, false);
    expect(m).toBeLessThan(0.05);
  });

  it('permanece na faixa 0..1', () => {
    expect(updateMastery(0, true)).toBeGreaterThanOrEqual(0);
    expect(updateMastery(1, false)).toBeLessThanOrEqual(1);
  });
});
