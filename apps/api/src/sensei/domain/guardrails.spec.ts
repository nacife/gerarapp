import { describe, expect, it } from 'vitest';
import type { TutorChunk } from '@eduforge/ai';
import { GATE_REFUSALS, SIMILARITY_THRESHOLD, enforceCitationGate, selectContext } from './guardrails';

function chunk(blockId: string, similarity: number): TutorChunk {
  return { blockId, contentMd: `conteúdo de ${blockId}`, sourceRef: { page: 1 }, similarity };
}

describe('selectContext', () => {
  it('filtra abaixo do limiar, ordena por similaridade e corta no top-k', () => {
    const out = selectContext(
      [chunk('a', 0.05), chunk('b', 0.9), chunk('c', 0.4), chunk('d', 0.6), chunk('e', 0.5), chunk('f', 0.3)],
      3,
    );
    expect(out.map((c) => c.blockId)).toEqual(['b', 'd', 'e']);
  });

  it('tudo abaixo do limiar → contexto vazio (fora de escopo)', () => {
    expect(selectContext([chunk('a', 0.01), chunk('b', SIMILARITY_THRESHOLD - 0.001)])).toHaveLength(0);
  });

  it('exatamente no limiar entra', () => {
    expect(selectContext([chunk('a', SIMILARITY_THRESHOLD)])).toHaveLength(1);
  });
});

describe('enforceCitationGate — o portão do DoD', () => {
  const context = [chunk('b1', 0.8), chunk('b2', 0.5)];

  it('resposta com citação válida passa, com sourceRef resolvido', () => {
    const out = enforceCitationGate(
      { answer: 'A resposta.', citations: [{ blockId: 'b1' }], refused: false },
      context,
      'formal',
    );
    expect(out.refused).toBe(false);
    expect(out.citations).toEqual([{ blockId: 'b1', sourceRef: { page: 1 } }]);
  });

  it('resposta SEM citação vira recusa — nunca chega ao aprendiz', () => {
    const out = enforceCitationGate({ answer: 'Resposta inventada.', citations: [], refused: false }, context, 'formal');
    expect(out.refused).toBe(true);
    expect(out.answer).toBe(GATE_REFUSALS.formal);
    expect(out.citations).toHaveLength(0);
  });

  it('citação para bloco FORA do contexto recuperado é descartada (alucinação de citação)', () => {
    const out = enforceCitationGate(
      { answer: 'Resposta.', citations: [{ blockId: 'inexistente' }], refused: false },
      context,
      'motivador',
    );
    expect(out.refused).toBe(true);
    expect(out.answer).toBe(GATE_REFUSALS.motivador);
  });

  it('mistura de citações válidas e inválidas mantém só as válidas, sem duplicar', () => {
    const out = enforceCitationGate(
      {
        answer: 'Resposta.',
        citations: [{ blockId: 'b2' }, { blockId: 'falso' }, { blockId: 'b2' }, { blockId: 'b1' }],
        refused: false,
      },
      context,
      'formal',
    );
    expect(out.refused).toBe(false);
    expect(out.citations.map((c) => c.blockId)).toEqual(['b2', 'b1']);
  });

  it('recusa do provider passa como recusa (sem citações)', () => {
    const out = enforceCitationGate({ answer: 'Fora do escopo.', citations: [], refused: true }, context, 'descontraido');
    expect(out.refused).toBe(true);
    expect(out.answer).toBe('Fora do escopo.');
  });
});
