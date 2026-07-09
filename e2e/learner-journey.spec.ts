import { expect, test } from '@playwright/test';

const SLUG = 'biologia-viva-demo';
const API = 'http://localhost:3333';

/**
 * E2E (M5 DoD): aprendiz conclui o app seed "Biologia Viva Demo" e recebe um
 * certificado verificável. Cobre, via clique real, 6 dos 9 tipos de interação
 * (quiz, dragdrop, flashcard_deck×3, cloze, hotspot, timeline) — a conclusão é
 * por BLOCO de conteúdo (qualquer interação correta do bloco o marca como
 * concluído), então o certificado é emitido assim que os 2 blocos do app
 * fecham, antes de tocar em scenario/audio/mindmap (que pertencem ao mesmo
 * bloco já concluído pela timeline). Os 9 tipos são cobertos individualmente
 * pelos testes de `packages/schemas` (grading) e pelo smoke de API do M5.
 */
test('aprendiz conclui o app demo e recebe certificado verificável', async ({ page }) => {
  const email = `pw${Date.now()}@ex.com`;

  await page.goto(`/${SLUG}`);

  // Cadastro — conta leve (RF-04/RF-05)
  await page.getByPlaceholder('Seu nome').fill('Playwright E2E');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha (mín. 10 caracteres)').fill('SenhaForte123');
  await page.getByRole('button', { name: 'Criar conta e começar' }).click();

  await expect(page.getByRole('heading', { name: 'Biologia Viva Demo' })).toBeVisible({
    timeout: 15_000,
  });

  // Quiz — seleciona a alternativa correta e responde
  await page.getByRole('radio', { name: /Alternativa correta/ }).click();
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(page.getByText('✓ Interação concluída')).toBeVisible();

  // Arrastar e soltar — a ordem inicial já é a correta
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();

  // Flashcards — 3 cartões: vira e avalia "Bom" (RF-02 SM-2)
  for (let i = 0; i < 3; i++) {
    await page
      .locator('button')
      .filter({ hasText: /^(Conceito|Termo|Ideia) \d$/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Bom', exact: true }).click();
  }

  // Complete a lacuna
  await page.locator('input[type="text"], p input').first().fill('célula');
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();

  // Hotspot
  await page.getByRole('button', { name: 'Ponto central' }).click();

  // Linha do tempo (modo informativo)
  await page.getByRole('button', { name: 'Marcar como concluído', exact: true }).click();

  // Certificado emitido automaticamente ao concluir os 2 blocos do app
  await expect(page.getByText('Parabéns, curso concluído!')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Playwright E2E')).toBeVisible();
  await expect(page.getByText('✓ Certificado verificado e autêntico')).toBeVisible();

  // Extrai o código de verificação exibido e confirma que o PDF é real e baixável.
  const codeText = await page.getByText(/código\s+[A-F0-9]+/).textContent();
  const code = codeText?.match(/código\s+([A-F0-9]+)/)?.[1];
  expect(code).toBeTruthy();

  const verify = await page.request.get(`${API}/v1/public/certificates/${code}/verify`);
  expect(verify.ok()).toBe(true);
  const verifyBody = await verify.json();
  expect(verifyBody.valid).toBe(true);
  expect(verifyBody.projectTitle).toBe('Biologia Viva Demo');

  const pdfMeta = await page.request.get(`${API}/v1/public/certificates/${code}/pdf`);
  const { url } = await pdfMeta.json();
  const pdfRes = await page.request.get(url);
  expect(pdfRes.ok()).toBe(true);
  const bytes = await pdfRes.body();
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
});
