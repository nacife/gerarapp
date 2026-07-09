import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { evaluateFlag, rolloutBucket } from './feature-flags';

describe('evaluateFlag (RF-13)', () => {
  it('rollout de 10%: aproximadamente 10% dos sujeitos veem a flag', () => {
    const ids = Array.from({ length: 5000 }, () => randomUUID());
    const on = ids.filter((id) => evaluateFlag({ defaultOn: false, rolloutPct: 10 }, null, id, 'modo_historia'));
    const pct = (on.length / ids.length) * 100;
    expect(pct).toBeGreaterThan(7);
    expect(pct).toBeLessThan(13);
  });

  it('é determinístico: o mesmo sujeito sempre cai no mesmo lado', () => {
    const id = randomUUID();
    const a = evaluateFlag({ defaultOn: false, rolloutPct: 50 }, null, id, 'x');
    const b = evaluateFlag({ defaultOn: false, rolloutPct: 50 }, null, id, 'x');
    expect(a).toBe(b);
  });

  it('atribuição explícita fixa vence o rollout (usuário de teste)', () => {
    const id = randomUUID();
    // Mesmo com rollout 0% (ninguém deveria ver), a atribuição força enabled=true.
    expect(evaluateFlag({ defaultOn: false, rolloutPct: 0 }, { enabled: true }, id, 'x')).toBe(true);
    // E o inverso: rollout 100% mas atribuição força false.
    expect(evaluateFlag({ defaultOn: false, rolloutPct: 100 }, { enabled: false }, id, 'x')).toBe(false);
  });

  it('sem rollout nem atribuição, usa o default da flag', () => {
    const id = randomUUID();
    expect(evaluateFlag({ defaultOn: true, rolloutPct: 0 }, null, id, 'x')).toBe(true);
    expect(evaluateFlag({ defaultOn: false, rolloutPct: 0 }, null, id, 'x')).toBe(false);
  });

  it('rolloutBucket está sempre em 0..99', () => {
    for (let i = 0; i < 200; i++) {
      const b = rolloutBucket(randomUUID(), 'flag');
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });
});
