/**
 * Catálogo de conquistas (RF-06.7) — computadas na leitura a partir do
 * estado existente (xp, streak, progresso, certificado), sem tabela nova
 * (ADR-0067).
 */

export interface AchievementStats {
  doneBlocks: number;
  totalBlocks: number;
  xp: number;
  streakDays: number;
  /** true = 100% dos blocos concluídos. */
  completed: boolean;
  /** Certificado já foi emitido para esta matrícula? */
  certificateIssued: boolean;
}

export interface Achievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

const CATALOG: {
  key: string;
  title: string;
  description: string;
  icon: string;
  check: (s: AchievementStats) => boolean;
}[] = [
  {
    key: 'primeiro-passo',
    title: 'Primeiro Passo',
    description: 'Complete seu primeiro bloco de conteúdo.',
    icon: '👣',
    check: (s) => s.doneBlocks >= 1,
  },
  {
    key: 'em-ritmo',
    title: 'Em Ritmo',
    description: 'Mantenha uma sequência de 3 dias de estudo.',
    icon: '🔥',
    check: (s) => s.streakDays >= 3,
  },
  {
    key: 'semana-de-fogo',
    title: 'Semana de Fogo',
    description: 'Mantenha uma sequência de 7 dias consecutivos.',
    icon: '💥',
    check: (s) => s.streakDays >= 7,
  },
  {
    key: 'centuriao',
    title: 'Centurião',
    description: 'Acumule 100 pontos de XP.',
    icon: '💯',
    check: (s) => s.xp >= 100,
  },
  {
    key: 'sabio',
    title: 'Sábio',
    description: 'Acumule 500 pontos de XP.',
    icon: '🧠',
    check: (s) => s.xp >= 500,
  },
  {
    key: 'meio-caminho',
    title: 'Meio Caminho',
    description: 'Conclua 50% dos blocos do app.',
    icon: '🏔️',
    check: (s) => s.totalBlocks > 0 && s.doneBlocks / s.totalBlocks >= 0.5,
  },
  {
    key: 'conclusao',
    title: 'Conclusão',
    description: 'Conclua 100% dos blocos do app.',
    icon: '🏆',
    check: (s) => s.completed,
  },
  {
    key: 'certificado',
    title: 'Certificado',
    description: 'Receba o certificado de conclusão.',
    icon: '📜',
    check: (s) => s.certificateIssued,
  },
];

/** Computa quais conquistas estão desbloqueadas dado o estado do aprendiz. */
export function computeAchievements(stats: AchievementStats): Achievement[] {
  return CATALOG.map((c) => ({
    key: c.key,
    title: c.title,
    description: c.description,
    icon: c.icon,
    unlocked: c.check(stats),
  }));
}
