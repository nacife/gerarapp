import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import type { PackageFile } from './domain/package-builder';

interface ScreenshotTarget {
  filename: string;
  viewport: { width: number; height: number };
  colorScheme: 'light' | 'dark';
}

const TARGETS: ScreenshotTarget[] = [
  { filename: 'mobile-claro.png', viewport: { width: 390, height: 844 }, colorScheme: 'light' },
  { filename: 'mobile-escuro.png', viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
  { filename: 'desktop-claro.png', viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
  { filename: 'desktop-escuro.png', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
];

const DISABLE_ANIMATIONS_CSS =
  '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }';

export interface CaptureScreenshotsInput {
  apiBaseUrl: string;
  runtimeBaseUrl: string;
  slug: string;
}

/**
 * Captura telas reais do app publicado (mobile/desktop, claro/escuro) via Playwright
 * headless (RF-16.1, `02-telas/`). Como o runtime exige matrícula de aprendiz para
 * ver o conteúdo (mesmo em apps públicos), cria uma conta de aprendiz descartável
 * só para esta prévia — nunca é exposta ao titular nem usada fora da geração do pacote.
 */
export async function captureRuntimeScreenshots(input: CaptureScreenshotsInput): Promise<PackageFile[]> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();

    const previewEmail = `inpi-preview+${randomUUID()}@internal.eduforge.local`;
    const signup = await context.request.post(`${input.apiBaseUrl}/v1/learner/signup`, {
      data: { email: previewEmail, name: 'EduForge — Prévia INPI (sistema)', password: randomUUID() },
    });
    if (!signup.ok()) {
      throw new Error(`falha ao criar aprendiz de prévia para captura de telas: ${signup.status()}`);
    }
    const enroll = await context.request.post(
      `${input.apiBaseUrl}/v1/public/apps/${encodeURIComponent(input.slug)}/enroll`,
      { data: {} },
    );
    if (!enroll.ok()) {
      throw new Error(`falha ao matricular aprendiz de prévia: ${enroll.status()}`);
    }

    const results: PackageFile[] = [];
    for (const target of TARGETS) {
      const page = await context.newPage();
      await page.setViewportSize(target.viewport);
      await context.grantPermissions([]);
      await page.emulateMedia({ colorScheme: target.colorScheme });
      await page.goto(`${input.runtimeBaseUrl}/${input.slug}`, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
      await page.waitForTimeout(150);
      const bytes = await page.screenshot({ type: 'png' });
      results.push({ path: target.filename, content: bytes });
      await page.close();
    }

    return results;
  } finally {
    await browser.close();
  }
}
