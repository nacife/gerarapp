import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { PackageFile } from './domain/package-builder';

/** Trechos representativos do runtime licenciado (RF-16.1) — arquitetura de
 *  carregamento do manifesto, motor de renderização e um tipo de interação,
 *  suficientes para caracterizar a derivação sem embutir o runtime inteiro. */
const REPRESENTATIVE_FILES = [
  'apps/runtime/src/App.tsx',
  'apps/runtime/src/lib/manifest.ts',
  'apps/runtime/src/lib/color-scheme.ts',
  'apps/runtime/src/interactions/InteractionRunner.tsx',
  'apps/runtime/src/interactions/QuizView.tsx',
  'apps/runtime/src/lib/progress.ts',
];

/** Sobe a partir de `startDir` até achar a raiz do monorepo (`pnpm-workspace.yaml`). */
function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('não foi possível localizar a raiz do monorepo (pnpm-workspace.yaml)');
}

/** Lê os trechos representativos do runtime diretamente do checkout do monorepo. */
export function loadRuntimeSnippets(startDir: string = process.cwd()): PackageFile[] {
  const root = findMonorepoRoot(startDir);
  return REPRESENTATIVE_FILES.map((relativePath) => ({
    path: relativePath.replace(/^apps\/runtime\/src\//, ''),
    content: readFileSync(resolve(root, relativePath)),
  }));
}
