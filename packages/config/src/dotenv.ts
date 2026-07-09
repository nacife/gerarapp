import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Carrega o primeiro arquivo `.env` encontrado subindo a partir de `startDir`.
 * Necessário porque os apps de backend rodam a partir de `apps/<nome>` mas o
 * `.env` fica na raiz do monorepo. Retorna o caminho carregado, se houver.
 */
export function loadRootEnv(startDir: string = process.cwd()): string | undefined {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      dotenvConfig({ path: candidate });
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}
