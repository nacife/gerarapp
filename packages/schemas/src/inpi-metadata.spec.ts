import { describe, expect, it } from 'vitest';
import { buildFichaRegistro, buildMetadata, DECLARED_LANGUAGES } from './inpi-metadata';

const BASE = {
  title: 'Biologia Viva',
  slug: 'biologia-viva-demo',
  versionNumber: 3,
  createdAt: new Date('2026-01-10T12:00:00Z'),
  publishedAt: new Date('2026-06-12T09:30:00Z'),
  holderName: 'Marina (criadora)',
  algorithm: 'SHA-512',
};

describe('buildFichaRegistro', () => {
  it('deriva título sugerido, datas ISO e linguagens declaradas', () => {
    const ficha = buildFichaRegistro(BASE);
    expect(ficha.suggestedTitle).toBe('Biologia Viva (v3)');
    expect(ficha.creationDate).toBe('2026-01-10');
    expect(ficha.publicationDate).toBe('2026-06-12');
    expect(ficha.languages).toEqual(DECLARED_LANGUAGES);
    expect(ficha.derivationText).toContain('biologia-viva-demo');
    expect(ficha.derivationText).toContain('EduForge');
  });
});

describe('buildMetadata', () => {
  it('inclui título, versão, titular, autores e datas', () => {
    const metadata = buildMetadata({ ...BASE, authors: ['Marina (criadora)'] });
    expect(metadata.title).toBe('Biologia Viva');
    expect(metadata.versionNumber).toBe(3);
    expect(metadata.holderDeclared).toBe('Marina (criadora)');
    expect(metadata.authors).toEqual(['Marina (criadora)']);
    expect(metadata.languages).toEqual(DECLARED_LANGUAGES);
    expect(metadata.packageFormatVersion).toBe(1);
  });
});
