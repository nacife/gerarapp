export interface ChapterBlocks {
  chapterId: string;
  chapterTitle: string;
  blockIds: string[];
}

export interface ChapterStat {
  chapterId: string;
  chapterTitle: string;
  pct: number;
}

/** Taxa de conclusão por capítulo (RF-10): todos os blocos do capítulo concluídos. */
export function computeCompletionByChapter(
  chapters: ChapterBlocks[],
  enrollmentIds: string[],
  doneBlocksByEnrollment: Map<string, Set<string>>,
): ChapterStat[] {
  const total = enrollmentIds.length || 1;
  return chapters.map((ch) => {
    const doneCount = enrollmentIds.filter((eid) => {
      const done = doneBlocksByEnrollment.get(eid) ?? new Set<string>();
      return ch.blockIds.length > 0 && ch.blockIds.every((b) => done.has(b));
    }).length;
    return { chapterId: ch.chapterId, chapterTitle: ch.chapterTitle, pct: Math.round((doneCount / total) * 100) };
  });
}

/** Funil de abandono (RF-10): % de matrículas que ao menos tocaram o capítulo. */
export function computeAbandonmentFunnel(
  chapters: ChapterBlocks[],
  enrollmentIds: string[],
  touchedBlocksByEnrollment: Map<string, Set<string>>,
): ChapterStat[] {
  const total = enrollmentIds.length || 1;
  return chapters.map((ch) => {
    const reached = enrollmentIds.filter((eid) => {
      const touched = touchedBlocksByEnrollment.get(eid) ?? new Set<string>();
      return ch.blockIds.some((b) => touched.has(b));
    }).length;
    return { chapterId: ch.chapterId, chapterTitle: ch.chapterTitle, pct: Math.round((reached / total) * 100) };
  });
}

export interface AnswerEvent {
  interactionId: string;
  interactionType: string;
  contentBlockId: string;
  correct: boolean;
}

export interface DifficultyRow {
  interactionId: string;
  contentBlockId: string;
  interactionType: string;
  wrongCount: number;
  correctCount: number;
  errorRatePct: number;
}

/** Mapa de calor de dificuldade (RF-10): interações com mais erro primeiro. */
export function computeDifficultyHeatmap(events: AnswerEvent[]): DifficultyRow[] {
  const acc = new Map<string, { contentBlockId: string; interactionType: string; wrong: number; correct: number }>();
  for (const e of events) {
    const row = acc.get(e.interactionId) ?? {
      contentBlockId: e.contentBlockId,
      interactionType: e.interactionType,
      wrong: 0,
      correct: 0,
    };
    if (e.correct) row.correct += 1;
    else row.wrong += 1;
    acc.set(e.interactionId, row);
  }
  return [...acc.entries()]
    .map(([interactionId, r]) => {
      const totalAnswers = r.wrong + r.correct;
      return {
        interactionId,
        contentBlockId: r.contentBlockId,
        interactionType: r.interactionType,
        wrongCount: r.wrong,
        correctCount: r.correct,
        errorRatePct: totalAnswers > 0 ? Math.round((r.wrong / totalAnswers) * 100) : 0,
      };
    })
    .sort((a, b) => b.errorRatePct - a.errorRatePct);
}

/** Serialização CSV simples (RF-10: exportação). */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown): string => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return lines.join('\n');
}
