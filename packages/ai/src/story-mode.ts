/**
 * Modo História (RF-06.3) — reestrutura narrativa do conteúdo.
 * Converte capítulos em "regiões" de um mapa ilustrado,
 * quizzes viram "desafios de guardião", conclusão desbloqueia territórios.
 */

export interface StoryRegion {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** Blocos originais mapeados para esta região */
  blockIds: string[];
  /** Regiões que esta desbloqueia ao ser concluída */
  unlocks: string[];
  /** Posição no mapa (x, y %) */
  position: { x: number; y: number };
}

export interface StoryMap {
  title: string;
  regions: StoryRegion[];
  startRegionId: string;
  finalRegionId: string;
}

const REGION_EMOJIS = ['🏰', '🌋', '🌊', '🏔️', '🌴', '🏜️', '❄️', '🌪️', '🌌', '🏛️'];

/** Converte capítulos em regiões narrativas com mapa ilustrado */
export function buildStoryMap(chapterTitles: string[], blockIdsByChapter: Map<string, string[]>): StoryMap {
  const regions: StoryRegion[] = chapterTitles.map((title, i) => ({
    id: `region-${i}`,
    name: title,
    description: `Explore os segredos de "${title}" e domine seus conhecimentos.`,
    emoji: REGION_EMOJIS[i % REGION_EMOJIS.length]!,
    blockIds: blockIdsByChapter.get(title) ?? [],
    unlocks: i < chapterTitles.length - 1 ? [`region-${i + 1}`] : [],
    position: { x: 15 + (i % 4) * 22, y: 20 + Math.floor(i / 4) * 35 },
  }));

  return {
    title: `A Jornada do Conhecimento`,
    regions,
    startRegionId: 'region-0',
    finalRegionId: `region-${chapterTitles.length - 1}`,
  };
}

const GUARDIAN_NAMES = ['Guardião do Saber', 'Mestre dos Mistérios', 'Sentinelas do Conhecimento', 'Oráculo Ancestral', 'Dragão da Sabedoria'];

/** Transforma metadados de quiz em "desafio de guardião" com temática narrativa */
export function buildGuardianChallenge(quizTitle: string, chapterIndex: number): { guardianName: string; flavorText: string } {
  return {
    guardianName: GUARDIAN_NAMES[chapterIndex % GUARDIAN_NAMES.length]!,
    flavorText: `Para avançar além de "${quizTitle}", você deve enfrentar o ${GUARDIAN_NAMES[chapterIndex % GUARDIAN_NAMES.length]}. Responda corretamente para desbloquear o próximo território!`,
  };
}
