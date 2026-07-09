import { describe, expect, it } from 'vitest';
import { displayStatus, hasPendingChanges } from './pending-changes';

describe('hasPendingChanges', () => {
  it('rascunho (nunca publicado) nunca está "pendente"', () => {
    expect(
      hasPendingChanges({
        publishedAt: null,
        latestContentMapCreatedAt: new Date(),
        latestInteractionUpdatedAt: null,
        latestThemeCreatedAt: null,
      }),
    ).toBe(false);
  });

  it('publicado sem mudanças posteriores: não pendente', () => {
    const publishedAt = new Date('2026-07-01');
    expect(
      hasPendingChanges({
        publishedAt,
        latestContentMapCreatedAt: new Date('2026-06-30'),
        latestInteractionUpdatedAt: new Date('2026-06-29'),
        latestThemeCreatedAt: null,
      }),
    ).toBe(false);
  });

  it('interação editada depois da publicação: pendente', () => {
    const publishedAt = new Date('2026-07-01');
    expect(
      hasPendingChanges({
        publishedAt,
        latestContentMapCreatedAt: null,
        latestInteractionUpdatedAt: new Date('2026-07-02'),
        latestThemeCreatedAt: null,
      }),
    ).toBe(true);
  });
});

describe('displayStatus', () => {
  it('rascunho quando status != published', () => {
    expect(displayStatus('draft', false)).toBe('draft');
  });
  it('published quando publicado e sem pendências', () => {
    expect(displayStatus('published', false)).toBe('published');
  });
  it('pending_update quando publicado com pendências', () => {
    expect(displayStatus('published', true)).toBe('pending_update');
  });
});
