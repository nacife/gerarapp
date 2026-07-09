import type { Manifest } from '@eduforge/schemas';
import type { PackageFile } from './package-builder';

function canonicalJson(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(sortDeep(value), null, 2), 'utf-8');
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** Divide o manifesto imutável em arquivos individuais dentro de `01-codigo-fonte/app/` (RF-16.1). */
export function buildAppFiles(manifest: Manifest): PackageFile[] {
  const files: PackageFile[] = [
    { path: 'manifest.json', content: canonicalJson(manifest) },
    {
      path: 'theme/tokens.json',
      content: canonicalJson({
        template: manifest.theme.template,
        tokens: manifest.theme.tokens,
        typography: manifest.theme.typography,
        effects: manifest.theme.effects,
      }),
    },
    { path: 'theme/palette.json', content: canonicalJson(manifest.theme.palette) },
    { path: 'content/mapa-de-conteudo.json', content: canonicalJson(manifest.content) },
  ];

  for (const interaction of manifest.interactions) {
    files.push({
      path: `interactions/${interaction.id}.json`,
      content: canonicalJson(interaction),
    });
  }

  return files;
}
