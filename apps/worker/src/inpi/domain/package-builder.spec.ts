import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildInpiPackage, buildManifestFiles, type BuildInpiPackageInput } from './package-builder';
import { buildMetadata } from '@eduforge/schemas';

function fixture(): BuildInpiPackageInput {
  const metadata = buildMetadata({
    title: 'Biologia Viva',
    slug: 'biologia-viva-demo',
    versionNumber: 3,
    createdAt: new Date('2026-01-10T12:00:00Z'),
    publishedAt: new Date('2026-06-12T09:30:00Z'),
    holderName: 'Marina (criadora)',
    authors: ['Marina (criadora)'],
    algorithm: 'SHA-512',
  });

  return {
    appFiles: [
      { path: 'manifest.json', content: Buffer.from('{"a":1}') },
      { path: 'interactions/int-1.json', content: Buffer.from('{"type":"quiz"}') },
      { path: 'theme/tokens.json', content: Buffer.from('{"primary":"#000"}') },
    ],
    runtimeFiles: [{ path: 'App.tsx.txt', content: Buffer.from('export function App() {}') }],
    screenshots: [
      { path: 'mobile-light.png', content: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
      { path: 'desktop-dark.png', content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01]) },
    ],
    memorialPdf: Buffer.from('%PDF-1.7 memorial fake'),
    assets: [],
    metadata,
  };
}

describe('buildInpiPackage — reprodutibilidade (DoD M7)', () => {
  it('gerar o pacote 2x a partir da mesma entrada produz bytes e SHA-512 idênticos', async () => {
    const input = fixture();

    const zip1 = await buildInpiPackage(input);
    const zip2 = await buildInpiPackage(fixture()); // segunda "execução" independente

    const hash1 = createHash('sha512').update(zip1).digest('hex');
    const hash2 = createHash('sha512').update(zip2).digest('hex');

    expect(hash1).toBe(hash2);
    expect(zip1.equals(zip2)).toBe(true);
  });

  it('entradas diferentes produzem hashes diferentes (sensibilidade ao conteúdo)', async () => {
    const a = await buildInpiPackage(fixture());
    const changed = fixture();
    changed.appFiles[0]!.content = Buffer.from('{"a":2}');
    const b = await buildInpiPackage(changed);

    expect(createHash('sha512').update(a).digest('hex')).not.toBe(
      createHash('sha512').update(b).digest('hex'),
    );
  });
});

describe('buildManifestFiles', () => {
  it('lista SHA-256 por arquivo em ordem lexicográfica', () => {
    const files = [
      { path: 'b.txt', content: Buffer.from('B') },
      { path: 'a.txt', content: Buffer.from('A') },
    ];
    const manifest = buildManifestFiles(files);
    const lines = manifest.trim().split('\n');
    expect(lines[0]).toContain('a.txt');
    expect(lines[1]).toContain('b.txt');
    expect(lines[0]).toMatch(new RegExp(`^${createHash('sha256').update('A').digest('hex')}  a.txt$`));
  });
});
