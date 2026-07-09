import { describe, expect, it } from 'vitest';
import { envelopeSchema, INTERACTION_TYPES } from './envelope';

const validEnvelope = {
  schema_version: 1,
  type: 'quiz',
  source_ref: { content_block_id: '11111111-1111-1111-1111-111111111111' },
  difficulty: 'easy',
  objective: 'Compreender a estrutura da célula',
};

describe('envelopeSchema', () => {
  it('aceita um envelope válido e aplica o default de xp', () => {
    const parsed = envelopeSchema.parse(validEnvelope);
    expect(parsed.xp).toBe(10);
    expect(parsed.type).toBe('quiz');
  });

  it('expõe exatamente os 9 tipos canônicos', () => {
    expect(INTERACTION_TYPES).toHaveLength(9);
    expect(INTERACTION_TYPES).toContain('flashcard_deck');
  });

  it('rejeita content_block_id que não é uuid', () => {
    expect(() =>
      envelopeSchema.parse({
        ...validEnvelope,
        source_ref: { content_block_id: 'nope' },
      }),
    ).toThrow();
  });

  it('rejeita tipo desconhecido', () => {
    expect(() => envelopeSchema.parse({ ...validEnvelope, type: 'unknown' })).toThrow();
  });

  it('rejeita objective acima de 200 caracteres', () => {
    expect(() =>
      envelopeSchema.parse({ ...validEnvelope, objective: 'x'.repeat(201) }),
    ).toThrow();
  });
});
