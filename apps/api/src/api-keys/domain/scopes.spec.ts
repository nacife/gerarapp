import { describe, expect, it } from 'vitest';
import { API_KEY_SCOPES, hasScope, isValidScope } from './scopes';

describe('isValidScope', () => {
  it('aceita todo escopo do catálogo', () => {
    for (const scope of API_KEY_SCOPES) expect(isValidScope(scope)).toBe(true);
  });

  it('rejeita escopo inventado', () => {
    expect(isValidScope('projects:delete')).toBe(false);
  });
});

describe('hasScope', () => {
  it('concede quando o escopo exato está presente', () => {
    expect(hasScope(['projects:read'], 'projects:read')).toBe(true);
  });

  it('nega quando o escopo não está presente', () => {
    expect(hasScope(['projects:read'], 'projects:write')).toBe(false);
  });

  it('wildcard de namespace concede read e write', () => {
    expect(hasScope(['content:*'], 'content:read')).toBe(true);
    expect(hasScope(['content:*'], 'content:write')).toBe(true);
  });

  it('wildcard de um namespace não vaza para outro', () => {
    expect(hasScope(['content:*'], 'projects:read')).toBe(false);
  });
});
