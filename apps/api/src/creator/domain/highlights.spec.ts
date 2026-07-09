import { describe, expect, it } from 'vitest';
import { buildHighlights } from './highlights';

describe('buildHighlights', () => {
  it('destaca o app com mais sessões na semana', () => {
    const highlights = buildHighlights([
      { title: 'Biologia', sessionsThisWeek: 214, certificatesThisWeek: 0 },
      { title: 'Finanças', sessionsThisWeek: 12, certificatesThisWeek: 0 },
    ]);
    expect(highlights[0]).toContain('Biologia');
    expect(highlights[0]).toContain('214');
  });

  it('menciona certificados emitidos quando houver', () => {
    const highlights = buildHighlights([{ title: 'X', sessionsThisWeek: 0, certificatesThisWeek: 3 }]);
    expect(highlights.some((h) => h.includes('3 certificados'))).toBe(true);
  });

  it('sem atividade nenhuma: nenhum destaque', () => {
    expect(buildHighlights([{ title: 'X', sessionsThisWeek: 0, certificatesThisWeek: 0 }])).toEqual([]);
  });
});
