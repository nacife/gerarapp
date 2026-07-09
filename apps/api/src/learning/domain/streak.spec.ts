import { describe, expect, it } from 'vitest';
import { computeStreak, type StreakState } from './streak';

const empty: StreakState = { streakDays: 0, lastActivityAt: null, streakFreezeUsedAt: null };

describe('computeStreak', () => {
  it('primeira atividade inicia streak=1', () => {
    const r = computeStreak(empty, '2026-07-01');
    expect(r.streakDays).toBe(1);
  });

  it('atividade no mesmo dia não altera o estado', () => {
    const state: StreakState = { streakDays: 3, lastActivityAt: '2026-07-01', streakFreezeUsedAt: null };
    expect(computeStreak(state, '2026-07-01')).toEqual(state);
  });

  it('dia consecutivo incrementa a streak', () => {
    const state: StreakState = { streakDays: 3, lastActivityAt: '2026-07-01', streakFreezeUsedAt: null };
    const r = computeStreak(state, '2026-07-02');
    expect(r.streakDays).toBe(4);
    expect(r.lastActivityAt).toBe('2026-07-02');
  });

  it('gap de 1 dia perdido é protegido (consome freeze) uma vez', () => {
    const state: StreakState = { streakDays: 5, lastActivityAt: '2026-07-01', streakFreezeUsedAt: null };
    const r = computeStreak(state, '2026-07-03'); // pulou o dia 02
    expect(r.streakDays).toBe(6);
    expect(r.streakFreezeUsedAt).toBe('2026-07-03');
  });

  it('freeze não se aplica duas vezes na mesma semana', () => {
    const afterFreeze: StreakState = { streakDays: 6, lastActivityAt: '2026-07-03', streakFreezeUsedAt: '2026-07-03' };
    // pula outro dia logo em seguida — freeze ainda em cooldown
    const r = computeStreak(afterFreeze, '2026-07-05');
    expect(r.streakDays).toBe(1);
  });

  it('gap de 2+ dias sem freeze disponível reseta para 1', () => {
    const state: StreakState = { streakDays: 10, lastActivityAt: '2026-06-01', streakFreezeUsedAt: null };
    const r = computeStreak(state, '2026-07-01');
    expect(r.streakDays).toBe(1);
  });
});
