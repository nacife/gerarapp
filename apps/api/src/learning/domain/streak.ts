export interface StreakState {
  streakDays: number;
  lastActivityAt: string | null; // YYYY-MM-DD (UTC)
  streakFreezeUsedAt: string | null; // YYYY-MM-DD (UTC)
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FREEZE_COOLDOWN_DAYS = 7;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(...parseIso(b)) - Date.UTC(...parseIso(a))) / DAY_MS);
}
function parseIso(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m - 1, d];
}

/**
 * Sequência de dias com 1 "congelamento" de proteção por semana: perder
 * exatamente 1 dia não quebra a streak (consome o freeze); perder 2+ reseta.
 * (RF-05: "streak com proteção de streak".)
 */
export function computeStreak(state: StreakState, todayIso: string): StreakState {
  if (!state.lastActivityAt) {
    return { streakDays: 1, lastActivityAt: todayIso, streakFreezeUsedAt: state.streakFreezeUsedAt };
  }
  if (state.lastActivityAt === todayIso) {
    return state; // já contabilizado hoje
  }

  const gap = daysBetween(state.lastActivityAt, todayIso);
  if (gap === 1) {
    return {
      streakDays: state.streakDays + 1,
      lastActivityAt: todayIso,
      streakFreezeUsedAt: state.streakFreezeUsedAt,
    };
  }

  const freezeAvailable =
    !state.streakFreezeUsedAt || daysBetween(state.streakFreezeUsedAt, todayIso) >= FREEZE_COOLDOWN_DAYS;
  if (gap === 2 && freezeAvailable) {
    return { streakDays: state.streakDays + 1, lastActivityAt: todayIso, streakFreezeUsedAt: todayIso };
  }

  return { streakDays: 1, lastActivityAt: todayIso, streakFreezeUsedAt: state.streakFreezeUsedAt };
}
