import { describe, expect, it } from 'vitest';
import { makeEnvelope, makeUserSeed } from './factories';

describe('factories', () => {
  it('makeEnvelope produz um envelope válido', () => {
    const env = makeEnvelope();
    expect(env.type).toBe('quiz');
    expect(env.xp).toBe(10);
  });

  it('makeEnvelope aceita overrides', () => {
    const env = makeEnvelope({ type: 'cloze', difficulty: 'hard' });
    expect(env.type).toBe('cloze');
    expect(env.difficulty).toBe('hard');
  });

  it('makeUserSeed usa defaults e overrides', () => {
    expect(makeUserSeed().role).toBe('creator');
    expect(makeUserSeed({ role: 'admin' }).role).toBe('admin');
  });
});
