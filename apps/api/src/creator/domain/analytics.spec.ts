import { describe, expect, it } from 'vitest';
import {
  computeAbandonmentFunnel,
  computeCompletionByChapter,
  computeDifficultyHeatmap,
  toCsv,
  type ChapterBlocks,
} from './analytics';

const chapters: ChapterBlocks[] = [
  { chapterId: 'c1', chapterTitle: 'Cap 1', blockIds: ['b1', 'b2'] },
  { chapterId: 'c2', chapterTitle: 'Cap 2', blockIds: ['b3'] },
];
const enrollmentIds = ['e1', 'e2', 'e3', 'e4'];

describe('computeCompletionByChapter', () => {
  it('calcula % de matrículas com TODOS os blocos do capítulo concluídos', () => {
    const done = new Map<string, Set<string>>([
      ['e1', new Set(['b1', 'b2'])], // completou cap 1 inteiro
      ['e2', new Set(['b1'])], // só metade do cap 1
      ['e3', new Set(['b1', 'b2', 'b3'])], // completou tudo
      ['e4', new Set()],
    ]);
    const stats = computeCompletionByChapter(chapters, enrollmentIds, done);
    expect(stats.find((s) => s.chapterId === 'c1')?.pct).toBe(50); // e1 e e3 = 2/4
    expect(stats.find((s) => s.chapterId === 'c2')?.pct).toBe(25); // só e3 = 1/4
  });
});

describe('computeAbandonmentFunnel', () => {
  it('calcula % de matrículas que ao menos tocaram o capítulo', () => {
    const touched = new Map<string, Set<string>>([
      ['e1', new Set(['b1'])],
      ['e2', new Set(['b3'])],
      ['e3', new Set()],
      ['e4', new Set()],
    ]);
    const funnel = computeAbandonmentFunnel(chapters, enrollmentIds, touched);
    expect(funnel.find((f) => f.chapterId === 'c1')?.pct).toBe(25);
    expect(funnel.find((f) => f.chapterId === 'c2')?.pct).toBe(25);
  });
});

describe('computeDifficultyHeatmap', () => {
  it('ordena por maior taxa de erro primeiro', () => {
    const rows = computeDifficultyHeatmap([
      { interactionId: 'i1', interactionType: 'quiz', contentBlockId: 'b1', correct: false },
      { interactionId: 'i1', interactionType: 'quiz', contentBlockId: 'b1', correct: false },
      { interactionId: 'i1', interactionType: 'quiz', contentBlockId: 'b1', correct: true },
      { interactionId: 'i2', interactionType: 'cloze', contentBlockId: 'b2', correct: true },
      { interactionId: 'i2', interactionType: 'cloze', contentBlockId: 'b2', correct: true },
    ]);
    expect(rows[0]!.interactionId).toBe('i1');
    expect(rows[0]!.errorRatePct).toBe(67);
    expect(rows[1]!.errorRatePct).toBe(0);
  });
});

describe('toCsv', () => {
  it('gera cabeçalho e linhas, com escape de vírgulas', () => {
    const csv = toCsv([{ a: 1, b: 'x,y' }]);
    expect(csv).toBe('a,b\n1,"x,y"');
  });
  it('vazio retorna string vazia', () => {
    expect(toCsv([])).toBe('');
  });
});
