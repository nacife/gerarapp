/**
 * Coleção Supertest do fluxo B.3 ponta a ponta (M9 DoD): upload → ingestão →
 * aprovação → geração → tema → publicação, autenticado por API KEY (Bearer
 * efk_…), contra a API REAL em :3333. Exige api + worker + docker no ar
 * (mesmo pré-requisito do Playwright E2E): `pnpm --filter @eduforge/api test:api`.
 */
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const API = process.env.API_BASE_URL ?? 'http://localhost:3333';
const api = request(API);

const MARKDOWN_SOURCE = `# Fotossíntese

## O que é

A fotossíntese converte luz, água e CO2 em glicose e oxigênio dentro dos cloroplastos.

## Etapas

A fase clara acontece nos tilacoides e produz ATP e NADPH. A fase escura (ciclo de Calvin)
usa esses produtos para fixar carbono no estroma.

## Importância

Praticamente toda a energia dos ecossistemas vem da fotossíntese, direta ou indiretamente.
`;

let sessionCookies: string[] = [];
let apiKey = '';
let apiKeyId = '';
let readOnlyKey = '';
let readOnlyKeyId = '';
let projectId = '';
let fileId = '';
let uploadUrl = '';
let ingestJobId = '';
let generateJobId = '';
let publishResult: { versionNumber: number; url: string; bundleSha512: string } | null = null;

function bearer(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}

async function waitForJob(jobId: string, timeoutMs = 60_000): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  for (;;) {
    const res = await api.get(`/v1/jobs/${jobId}`).set(bearer(apiKey));
    expect(res.status).toBe(200);
    if (res.body.status === 'succeeded') return res.body;
    if (res.body.status === 'failed') {
      throw new Error(`job ${jobId} falhou: ${JSON.stringify(res.body.error ?? res.body)}`);
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`job ${jobId} não terminou em ${timeoutMs}ms (status: ${res.body.status})`);
    }
    await new Promise((r) => setTimeout(r, 750));
  }
}

beforeAll(async () => {
  // Chaves são criadas pela sessão do painel (B.1: "criadas no painel do criador").
  const login = await api
    .post('/v1/auth/login')
    .send({ email: 'marina@exemplo.com', password: 'EduForge!2026' });
  expect(login.status).toBe(200);
  sessionCookies = login.get('Set-Cookie') ?? [];
  expect(sessionCookies.length).toBeGreaterThan(0);

  const created = await api
    .post('/v1/api-keys')
    .set('Cookie', sessionCookies)
    .send({
      name: 'Supertest B.3',
      environment: 'live',
      scopes: [
        'projects:read',
        'projects:write',
        'content:read',
        'content:write',
        'jobs:read',
        'ai:invoke',
        'design:read',
        'design:write',
        'publish',
      ],
    });
  expect(created.status).toBe(201);
  apiKey = created.body.key;
  apiKeyId = created.body.id;
  expect(apiKey.startsWith('efk_live_')).toBe(true);

  const readOnly = await api
    .post('/v1/api-keys')
    .set('Cookie', sessionCookies)
    .send({ name: 'Supertest somente leitura', environment: 'live', scopes: ['projects:read'] });
  expect(readOnly.status).toBe(201);
  readOnlyKey = readOnly.body.key;
  readOnlyKeyId = readOnly.body.id;
}, 30_000);

afterAll(async () => {
  for (const id of [apiKeyId, readOnlyKeyId]) {
    if (id) await api.delete(`/v1/api-keys/${id}`).set('Cookie', sessionCookies);
  }
});

describe('Fluxo B.3 — upload → publicação com API key', () => {
  it('POST /projects → 201 com id', async () => {
    const res = await api
      .post('/v1/projects')
      .set(bearer(apiKey))
      .send({ title: `Supertest B.3 ${new Date().toISOString()}` });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    projectId = res.body.id;
  });

  it('respostas autenticadas por chave carregam os headers X-RateLimit-* (B.1)', async () => {
    const res = await api.get('/v1/projects').set(bearer(apiKey));
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('120');
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeGreaterThan(0);
    expect(res.headers['x-ratelimit-reset']).toMatch(/^\d+$/);
  });

  it('POST /projects/{id}/source-files → 201 com upload_url + file_id', async () => {
    const bytes = Buffer.from(MARKDOWN_SOURCE, 'utf8');
    const res = await api
      .post(`/v1/projects/${projectId}/source-files`)
      .set(bearer(apiKey))
      .send({
        filename: 'fotossintese.md',
        contentType: 'text/markdown',
        sizeBytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    expect(res.status).toBe(201);
    expect(res.body.uploadUrl).toContain('http');
    expect(res.body.fileId).toBeTruthy();
    uploadUrl = res.body.uploadUrl;
    fileId = res.body.fileId;
  });

  it('PUT {upload_url} sobe os bytes direto no storage (S3 pré-assinado)', async () => {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'text/markdown' },
      body: MARKDOWN_SOURCE,
    });
    expect(res.status).toBe(200);
  });

  it('POST /source-files/{id}/ingest → 202 com job_id', async () => {
    const res = await api.post(`/v1/source-files/${fileId}/ingest`).set(bearer(apiKey));
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeTruthy();
    ingestJobId = res.body.jobId;
  });

  it('GET /jobs/{id} termina em succeeded (worker real consumindo a fila)', async () => {
    const job = await waitForJob(ingestJobId);
    expect(job.status).toBe('succeeded');
  }, 70_000);

  it('POST /projects/{id}/content-map/approve → 200', async () => {
    const res = await api.post(`/v1/projects/${projectId}/content-map/approve`).set(bearer(apiKey));
    expect(res.status).toBe(200);
  });

  it('POST /projects/{id}/interactions/generate → job succeeded com interações', async () => {
    const res = await api
      .post(`/v1/projects/${projectId}/interactions/generate`)
      .set(bearer(apiKey))
      .send({ density: 'light' });
    expect(res.status).toBe(202);
    generateJobId = res.body.jobId;

    const job = await waitForJob(generateJobId);
    const progress = job.progress as { result?: { generated: number } };
    expect(progress.result?.generated ?? 0).toBeGreaterThan(0);
  }, 70_000);

  it('PUT /projects/{id}/theme aplica template + paleta do catálogo', async () => {
    const [templates, palettes] = await Promise.all([
      api.get('/v1/templates').set(bearer(apiKey)),
      api.get('/v1/palettes').set(bearer(apiKey)),
    ]);
    expect(templates.status).toBe(200);
    expect(palettes.status).toBe(200);
    const template = templates.body[0];
    const palette = palettes.body[0];
    expect(template?.key).toBeTruthy();
    expect(palette?.colors?.light).toBeTruthy();

    const res = await api
      .put(`/v1/projects/${projectId}/theme`)
      .set(bearer(apiKey))
      .send({ template: template.key, palette: palette.colors, typography: {}, effects: {} });
    expect(res.status).toBe(200);
  });

  it('POST /projects/{id}/publish com Idempotency-Key → 201 com bundle_sha512', async () => {
    const idempotencyKey = `b3-${randomUUID()}`;
    const res = await api
      .post(`/v1/projects/${projectId}/publish`)
      .set(bearer(apiKey))
      .set('Idempotency-Key', idempotencyKey)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.versionNumber).toBe(1);
    expect(res.body.url).toContain('http');
    expect(res.body.bundleSha512).toMatch(/^[a-f0-9]{128}$/);
    publishResult = res.body;

    // B.1: repetir a MESMA Idempotency-Key devolve a resposta original (não publica v2).
    const replay = await api
      .post(`/v1/projects/${projectId}/publish`)
      .set(bearer(apiKey))
      .set('Idempotency-Key', idempotencyKey)
      .send({});
    expect(replay.body).toEqual(publishResult);
  });

  it('publicar SEM Idempotency-Key é rejeitado (B.1: obrigatória em /publish)', async () => {
    const res = await api.post(`/v1/projects/${projectId}/publish`).set(bearer(apiKey)).send({});
    expect(res.status).toBe(400);
    expect(res.body.type).toContain('idempotency');
  });
});

describe('Erros do contrato (B.5)', () => {
  it('chave inválida → 401 Problem Details', async () => {
    const res = await api.get('/v1/projects').set(bearer('efk_live_chave-invalida'));
    expect(res.status).toBe(401);
    expect(res.body.type).toBeTruthy();
    expect(res.body.trace_id).toBeTruthy();
  });

  it('escopo insuficiente → 403 (chave só de leitura tentando criar projeto)', async () => {
    const res = await api
      .post('/v1/projects')
      .set(bearer(readOnlyKey))
      .send({ title: 'não deveria criar' });
    expect(res.status).toBe(403);
  });

  it('validação Zod → 400 com Problem Details', async () => {
    const res = await api.post('/v1/projects').set(bearer(apiKey)).send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe(400);
  });
});
