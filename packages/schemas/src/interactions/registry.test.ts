import { describe, expect, it } from 'vitest';
import { INTERACTION_TYPES } from './envelope';
import { buildValidInteraction } from './fixtures';
import { validateInteraction } from './registry';

const BLOCK = '11111111-1111-1111-1111-111111111111';

describe('validateInteraction — payloads válidos (todos os 9 tipos)', () => {
  for (const type of INTERACTION_TYPES) {
    it(`aceita ${type} válido`, () => {
      const result = validateInteraction(buildValidInteraction(type, BLOCK));
      expect(result.ok, result.errors.join(' | ')).toBe(true);
      expect(result.type).toBe(type);
      expect(result.data).toBeDefined();
    });
  }

  it('propriedade: 50 payloads gerados (seeds variados) são todos válidos', () => {
    for (let seed = 0; seed < 50; seed++) {
      const type = INTERACTION_TYPES[seed % INTERACTION_TYPES.length];
      expect(validateInteraction(buildValidInteraction(type, BLOCK, seed)).ok).toBe(true);
    }
  });
});

describe('validateInteraction — rejeita payloads inválidos', () => {
  it('quiz single sem alternativa correta (US-IA-01)', () => {
    const quiz = buildValidInteraction('quiz', BLOCK) as any;
    quiz.options.forEach((o: any) => (o.correct = false));
    const r = validateInteraction(quiz);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/1 alternativa correta/);
  });

  it('quiz single com duas corretas', () => {
    const quiz = buildValidInteraction('quiz', BLOCK) as any;
    quiz.options[1].correct = true;
    expect(validateInteraction(quiz).ok).toBe(false);
  });

  it('cloze com marcador sem gap correspondente', () => {
    const cloze = buildValidInteraction('cloze', BLOCK) as any;
    cloze.text_template_md = 'A {{gap:g1}} e o {{gap:g9}} não existem juntos.';
    const r = validateInteraction(cloze);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/g9/);
  });

  it('dragdrop ordering com posições não contíguas', () => {
    const dd = buildValidInteraction('dragdrop', BLOCK) as any;
    dd.items[2].correct_position = 5;
    expect(validateInteraction(dd).ok).toBe(false);
  });

  it('scenario com ciclo é rejeitado', () => {
    const sc = buildValidInteraction('scenario', BLOCK) as any;
    // torna o outcome o1 uma situação que aponta de volta para s1 → ciclo
    sc.nodes[1] = {
      id: 'o1',
      kind: 'situation',
      text_md: 'volta',
      choices: [
        { label_md: 'volta', next_node_id: 's1', quality: 'poor' },
        { label_md: 'segue', next_node_id: 'o2', quality: 'best' },
      ],
    };
    const r = validateInteraction(sc);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/ciclo/);
  });

  it('mindmap com aresta para nó inexistente', () => {
    const mm = buildValidInteraction('mindmap', BLOCK) as any;
    mm.edges.push({ from: 'n1', to: 'n99' });
    expect(validateInteraction(mm).ok).toBe(false);
  });

  it('tipo desconhecido e payload sem envelope', () => {
    expect(validateInteraction({ type: 'bogus' }).ok).toBe(false);
    const noEnvelope = buildValidInteraction('quiz', BLOCK) as any;
    delete noEnvelope.source_ref;
    expect(validateInteraction(noEnvelope).ok).toBe(false);
  });
});
