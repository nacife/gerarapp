import { describe, expect, it } from 'vitest';
import { sm2, type Sm2State } from './sm2';

const initial: Sm2State = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

describe('sm2', () => {
  it('primeira revisão boa: intervalo 1 dia, repetitions=1', () => {
    const r = sm2(initial, 4);
    expect(r.intervalDays).toBe(1);
    expect(r.repetitions).toBe(1);
  });

  it('segunda revisão boa: intervalo pula para 6 dias', () => {
    const r1 = sm2(initial, 4);
    const r2 = sm2(r1, 4);
    expect(r2.intervalDays).toBe(6);
    expect(r2.repetitions).toBe(2);
  });

  it('terceira revisão boa: intervalo multiplica pela ease', () => {
    const r1 = sm2(initial, 4);
    const r2 = sm2(r1, 4);
    const r3 = sm2(r2, 4);
    expect(r3.intervalDays).toBe(Math.round(6 * r2.easeFactor));
    expect(r3.repetitions).toBe(3);
  });

  it('qualidade baixa (esqueci) reseta repetitions e intervalo', () => {
    const r1 = sm2(initial, 4);
    const r2 = sm2(r1, 4);
    const forgot = sm2(r2, 1);
    expect(forgot.repetitions).toBe(0);
    expect(forgot.intervalDays).toBe(1);
  });

  it('ease factor nunca cai abaixo de 1.3', () => {
    let state = initial;
    for (let i = 0; i < 20; i++) state = sm2(state, 0);
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('nextReviewAt = now + intervalDays', () => {
    const now = new Date('2026-07-07T00:00:00Z');
    const r = sm2(initial, 4, now);
    expect(r.nextReviewAt.toISOString()).toBe('2026-07-08T00:00:00.000Z');
  });
});
