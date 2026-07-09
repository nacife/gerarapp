import { defineConfig, devices } from '@playwright/test';

/**
 * E2E do runtime (RF-05 / M5 DoD): "aprendiz conclui um app seed e recebe
 * certificado verificável". Assume a api já publicada em :3333 e sobe o
 * runtime dedicado em :5180 para o teste.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node apps/api/dist/main.js',
      url: 'http://localhost:3333/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'pnpm --filter @eduforge/runtime exec vite --port 5180',
      url: 'http://localhost:5180',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
