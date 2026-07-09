import { envelopeSchema, type Envelope } from '@eduforge/schemas';
import { FIXTURE_CONTENT_BLOCK_ID } from './fixtures';

/** Constrói um envelope de interação válido, com overrides opcionais. */
export function makeEnvelope(overrides: Record<string, unknown> = {}): Envelope {
  return envelopeSchema.parse({
    schema_version: 1,
    type: 'quiz',
    source_ref: { content_block_id: FIXTURE_CONTENT_BLOCK_ID },
    difficulty: 'easy',
    objective: 'Objetivo de aprendizagem de teste',
    ...overrides,
  });
}

export interface UserSeed {
  email: string;
  name: string;
  role: 'creator' | 'admin';
}

/** Constrói dados de usuário para testes/seed auxiliares. */
export function makeUserSeed(overrides: Partial<UserSeed> = {}): UserSeed {
  return {
    email: 'creator@test.local',
    name: 'Criador de Teste',
    role: 'creator',
    ...overrides,
  };
}
