import { describe, expect, it } from 'vitest';
import { computeAchievements, type AchievementStats } from './achievements';

const base: AchievementStats = {
  doneBlocks: 0,
  totalBlocks: 10,
  xp: 0,
  streakDays: 0,
  completed: false,
  certificateIssued: false,
};

function unlockedKeys(stats: AchievementStats): string[] {
  return computeAchievements(stats)
    .filter((a) => a.unlocked)
    .map((a) => a.key);
}

describe('computeAchievements', () => {
  it('aprendiz novo não tem nenhuma conquista', () => {
    expect(unlockedKeys(base)).toEqual([]);
  });

  it('primeiro-passo desbloqueia com ≥1 bloco concluído', () => {
    expect(unlockedKeys({ ...base, doneBlocks: 1 })).toContain('primeiro-passo');
  });

  it('em-ritmo desbloqueia com streak ≥3', () => {
    expect(unlockedKeys({ ...base, streakDays: 3 })).toContain('em-ritmo');
    expect(unlockedKeys({ ...base, streakDays: 3 })).not.toContain('semana-de-fogo');
  });

  it('semana-de-fogo desbloqueia com streak ≥7', () => {
    const s = unlockedKeys({ ...base, streakDays: 7 });
    expect(s).toContain('em-ritmo');
    expect(s).toContain('semana-de-fogo');
  });

  it('centuriao com xp≥100, sabio com xp≥500', () => {
    expect(unlockedKeys({ ...base, xp: 100 })).toContain('centuriao');
    expect(unlockedKeys({ ...base, xp: 100 })).not.toContain('sabio');
    expect(unlockedKeys({ ...base, xp: 500 })).toContain('sabio');
  });

  it('meio-caminho com ≥50%', () => {
    expect(unlockedKeys({ ...base, doneBlocks: 5, totalBlocks: 10 })).toContain('meio-caminho');
    expect(unlockedKeys({ ...base, doneBlocks: 4, totalBlocks: 10 })).not.toContain('meio-caminho');
  });

  it('conclusao com 100%', () => {
    expect(unlockedKeys({ ...base, doneBlocks: 10, totalBlocks: 10, completed: true })).toContain('conclusao');
  });

  it('certificado quando emitido', () => {
    expect(unlockedKeys({ ...base, certificateIssued: true })).toContain('certificado');
  });

  it('aprendiz completo desbloqueia todas as 8 conquistas', () => {
    const all = unlockedKeys({
      doneBlocks: 10,
      totalBlocks: 10,
      xp: 500,
      streakDays: 7,
      completed: true,
      certificateIssued: true,
    });
    expect(all).toHaveLength(8);
  });
});
