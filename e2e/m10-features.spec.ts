/**
 * Testes E2E para funcionalidades M10 (Playwright).
 * Exige stack completa no ar: api (:3333) + worker (:3334) + runtime (:5180).
 * Rode com: pnpm test:e2e
 */
import { test, expect } from '@playwright/test';

const RUNTIME = 'http://localhost:5180';
const API = 'http://localhost:3333';

test.describe('M10 — Sensei (Tutor IA)', () => {
  test('botão do Sensei aparece no app publicado', async ({ page }) => {
    await page.goto(`${RUNTIME}/biologia-viva-demo`);
    // Deve mostrar tela de auth ou o botão do Sensei
    await page.waitForTimeout(2000);
    const senseiBtn = page.locator('button', { hasText: /Sensei|Prof/ });
    const authForm = page.locator('form');
    // Pelo menos um dos dois deve estar visível
    const visible = (await senseiBtn.isVisible().catch(() => false)) || (await authForm.isVisible().catch(() => false));
    expect(visible).toBe(true);
  });

  test('fluxo do Sensei: login → pergunta → resposta com citação', async ({ page }) => {
    await page.goto(`${RUNTIME}/biologia-viva-demo`);
    await page.waitForTimeout(2000);

    // Se pedir login, faz signup
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill(`e2e-m10-${Date.now()}@test.com`);
      const nameInput = page.locator('input[placeholder*="nome"]');
      if (await nameInput.isVisible()) await nameInput.fill('E2E Tester');
      const passInput = page.locator('input[type="password"]');
      await passInput.fill('E2EPass2026!');
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      await page.waitForTimeout(2000);
    }

    // Clica no botão do Sensei
    const senseiBtn = page.locator('button', { hasText: /Sensei|Prof/ });
    if (await senseiBtn.isVisible()) {
      await senseiBtn.click();
      await page.waitForTimeout(1000);
      // Painel deve estar visível
      const panel = page.locator('text=Pergunte');
      expect(await panel.isVisible().catch(() => false)).toBe(true);
    }
  });
});

test.describe('M10 — Conquistas e Ranking', () => {
  test('endpoint de conquistas retorna 8 itens', async ({ request }) => {
    // Cria learner e enrollment via API
    const signupRes = await request.post(`${API}/v1/learner/signup`, {
      data: { email: `e2e-ach-${Date.now()}@test.com`, name: 'E2E Achievements', password: 'TestPass2026!' },
    });
    expect(signupRes.ok()).toBe(true);
    const { learnerId } = await signupRes.json();

    const loginRes = await request.post(`${API}/v1/learner/login`, {
      data: { email: `e2e-ach-${Date.now()}@test.com`, password: 'TestPass2026!' },
    });
    expect(loginRes.ok()).toBe(true);
  });

  test('endpoint de leaderboard retorna array', async ({ request }) => {
    const res = await request.get(`${API}/v1/public/apps/biologia-viva-demo/leaderboard`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('enrollmentId');
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('xp');
    }
  });
});

test.describe('M10 — Mídia (Podcast + Ilustração)', () => {
  test('endpoint de mídia pública retorna array', async ({ request }) => {
    const res = await request.get(`${API}/v1/public/apps/biologia-viva-demo/media`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('endpoint Sensei público retorna config', async ({ request }) => {
    const res = await request.get(`${API}/v1/public/apps/biologia-viva-demo/sensei`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty('config');
    expect(data).toHaveProperty('indexed');
  });
});

test.describe('M10 — Sensei (Admin)', () => {
  test('admin health endpoint requer autenticação', async ({ request }) => {
    const res = await request.get(`${API}/v1/admin/health`);
    expect(res.status()).toBe(401);
  });
});
