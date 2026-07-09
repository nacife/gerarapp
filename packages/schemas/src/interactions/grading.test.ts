import { describe, expect, it } from 'vitest';
import { buildValidInteraction } from './fixtures';
import {
  gradeCloze,
  gradeDragdrop,
  gradeHotspot,
  gradeQuiz,
  gradeScenarioPath,
  gradeTimelineOrder,
  mindmapCompletionRatio,
  timelineCanonicalOrder,
} from './grading';
import type { Quiz } from './quiz';
import type { Cloze } from './cloze';
import type { Dragdrop } from './dragdrop';
import type { Timeline } from './timeline';
import type { Scenario } from './scenario';
import type { Mindmap } from './mindmap';

const BLOCK = '11111111-1111-1111-1111-111111111111';

describe('gradeQuiz', () => {
  const quiz = buildValidInteraction('quiz', BLOCK) as Quiz;
  const correctId = quiz.options.find((o) => o.correct)!.id;
  const wrongId = quiz.options.find((o) => !o.correct)!.id;

  it('acerta quando seleciona exatamente as corretas', () => {
    expect(gradeQuiz(quiz, [correctId])).toBe(true);
  });
  it('erra com seleção errada ou parcial', () => {
    expect(gradeQuiz(quiz, [wrongId])).toBe(false);
    expect(gradeQuiz(quiz, [correctId, wrongId])).toBe(false);
    expect(gradeQuiz(quiz, [])).toBe(false);
  });
});

describe('gradeCloze', () => {
  const cloze = buildValidInteraction('cloze', BLOCK) as Cloze;
  it('aceita resposta normalizada (case/acento-insensível)', () => {
    const res = gradeCloze(cloze, { g1: 'CÉLULA' });
    expect(res.allCorrect).toBe(true);
  });
  it('rejeita resposta errada', () => {
    const res = gradeCloze(cloze, { g1: 'mitocôndria' });
    expect(res.allCorrect).toBe(false);
    expect(res.perGap.g1).toBe(false);
  });
});

describe('gradeDragdrop', () => {
  it('ordering: aceita apenas a ordem correta', () => {
    const dd = buildValidInteraction('dragdrop', BLOCK) as Dragdrop;
    expect(gradeDragdrop(dd, { order: ['i1', 'i2', 'i3'] })).toBe(true);
    expect(gradeDragdrop(dd, { order: ['i2', 'i1', 'i3'] })).toBe(false);
  });
  it('matching: aceita apenas o mapeamento correto', () => {
    const dd = buildValidInteraction('dragdrop', BLOCK, 5) as Dragdrop;
    // fixtures só geram "ordering" por padrão; construímos um matching manualmente
    const matching: Dragdrop = {
      ...dd,
      variant: 'matching',
      items: [
        { id: 'a', label_md: 'A', match_target_id: 't1' },
        { id: 'b', label_md: 'B', match_target_id: 't2' },
      ],
      targets: [
        { id: 't1', label_md: 'T1' },
        { id: 't2', label_md: 'T2' },
      ],
    };
    expect(gradeDragdrop(matching, { mapping: { a: 't1', b: 't2' } })).toBe(true);
    expect(gradeDragdrop(matching, { mapping: { a: 't2', b: 't1' } })).toBe(false);
  });
});

describe('timeline', () => {
  const timeline = buildValidInteraction('timeline', BLOCK) as Timeline;
  it('ordem canônica segue a ordem autoral quando não há campo order', () => {
    expect(timelineCanonicalOrder(timeline)).toEqual(['e1', 'e2', 'e3']);
  });
  it('gradeTimelineOrder aceita só a ordem certa', () => {
    expect(gradeTimelineOrder(timeline, ['e1', 'e2', 'e3'])).toBe(true);
    expect(gradeTimelineOrder(timeline, ['e3', 'e1', 'e2'])).toBe(false);
  });
});

describe('gradeHotspot', () => {
  it('acerta quando o spot clicado é o perguntado', () => {
    expect(gradeHotspot('sp1', 'sp1')).toBe(true);
    expect(gradeHotspot('sp1', 'sp2')).toBe(false);
  });
});

describe('gradeScenarioPath', () => {
  const scenario = buildValidInteraction('scenario', BLOCK) as Scenario;
  it('caminho ótimo: chega no outcome, allBest=true, score alto', () => {
    const res = gradeScenarioPath(scenario, ['o1']);
    expect(res.valid).toBe(true);
    expect(res.reachedOutcome).toBe(true);
    expect(res.allBest).toBe(true);
    expect(res.outcomeScore).toBe(100);
  });
  it('caminho ruim: chega no outcome mas allBest=false', () => {
    const res = gradeScenarioPath(scenario, ['o2']);
    expect(res.allBest).toBe(false);
    expect(res.outcomeScore).toBe(20);
  });
  it('transição inexistente é inválida', () => {
    const res = gradeScenarioPath(scenario, ['node-que-nao-existe']);
    expect(res.valid).toBe(false);
  });
});

describe('mindmapCompletionRatio', () => {
  it('calcula a fração de nós visitados', () => {
    const mm = buildValidInteraction('mindmap', BLOCK) as Mindmap;
    expect(mindmapCompletionRatio(mm, ['n1'])).toBeCloseTo(1 / 3);
    expect(mindmapCompletionRatio(mm, ['n1', 'n2', 'n3'])).toBe(1);
    expect(mindmapCompletionRatio(mm, [])).toBe(0);
  });
});
