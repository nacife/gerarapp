import { defineConfig } from 'vitest/config';

/**
 * Coleção de integração da API pública (fluxo B.3) — roda contra a API REAL
 * em :3333 com worker + docker no ar. Fora do `pnpm verify` de propósito
 * (mesma razão do Playwright E2E): `pnpm --filter @eduforge/api test:api`.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.e2e.ts'],
    testTimeout: 90_000,
    hookTimeout: 30_000,
    // Fluxo é stateful (projeto → upload → publish): arquivos e casos em série.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
