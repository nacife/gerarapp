import { askSenseiSchema, senseiConfigSchema } from '../sensei/dto/schemas';
import type { ZodTypeAny } from 'zod';
import {
  createProjectSchema,
  initiateUploadSchema,
  updateContentMapSchema,
} from '../projects/dto/schemas';
import { editInteractionSchema, generateSchema } from '../interactions/dto/schemas';
import { fromLogoSchema, rollbackSchema, setAccessSchema, setThemeSchema } from '../studio/dto/schemas';
import { createApiKeySchema } from '../api-keys/dto/schemas';
import { createWebhookSchema, updateWebhookSchema } from '../webhooks/dto/schemas';
import { generatePackageSchema } from '../inpi/dto/schemas';
import { confirmPoaSchema, contractFilingSchema, submitDataSchema } from '../inpi-filing/dto/schemas';
import {
  enrollSchema,
  inviteSchema,
  learnerLoginSchema,
  learnerSignupSchema,
  recordEventSchema,
} from '../learning/dto/schemas';
import { dateRangeSchema } from '../creator/dto/schemas';
import type { ApiKeyScope } from '../api-keys/domain/scopes';

export type RouteAuth = 'creator' | 'learner' | 'public';

export interface RouteEntry {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Caminho estilo OpenAPI (sem o prefixo /v1): `/projects/{id}/publish`. */
  path: string;
  summary: string;
  tag: string;
  auth: RouteAuth;
  /** Escopo exigido quando autenticado por API key (tabela B.2). */
  scope?: ApiKeyScope;
  requestSchema?: ZodTypeAny;
  querySchema?: ZodTypeAny;
  /** Rota exige o header Idempotency-Key (B.1). */
  idempotencyKey?: boolean;
  successStatus?: number;
  successDescription?: string;
}

/**
 * Registro declarativo das rotas públicas do /v1 (tabela B.2 + webhooks B.4 +
 * rotas de aprendiz do runtime). Fonte dos request bodies: os MESMOS Zod DTOs
 * que validam as bordas — o documento OpenAPI é derivado deles, nunca duplicado.
 */
export const PUBLIC_API_ROUTES: RouteEntry[] = [
  // ─────────── Projetos e ingestão (RF-01) ───────────
  { method: 'post', path: '/projects', summary: 'Cria projeto', tag: 'Projetos', auth: 'creator', scope: 'projects:write', requestSchema: createProjectSchema, successStatus: 201 },
  { method: 'get', path: '/projects', summary: 'Lista projetos', tag: 'Projetos', auth: 'creator', scope: 'projects:read' },
  { method: 'get', path: '/projects/{id}', summary: 'Detalha projeto', tag: 'Projetos', auth: 'creator', scope: 'projects:read' },
  { method: 'post', path: '/projects/{id}/source-files', summary: 'Inicia upload (URL S3 pré-assinada + file_id)', tag: 'Projetos', auth: 'creator', scope: 'content:write', requestSchema: initiateUploadSchema, successStatus: 201 },
  { method: 'post', path: '/source-files/{id}/ingest', summary: 'Enfileira ingestão; retorna job_id', tag: 'Projetos', auth: 'creator', scope: 'content:write', successStatus: 202 },
  { method: 'get', path: '/jobs/{id}', summary: 'Status de job assíncrono (progresso por etapa)', tag: 'Projetos', auth: 'creator', scope: 'jobs:read' },
  { method: 'get', path: '/projects/{id}/content-map', summary: 'Lê o Mapa de Conteúdo', tag: 'Projetos', auth: 'creator', scope: 'content:read' },
  { method: 'put', path: '/projects/{id}/content-map', summary: 'Atualiza o Mapa de Conteúdo (árvore)', tag: 'Projetos', auth: 'creator', scope: 'content:write', requestSchema: updateContentMapSchema },
  { method: 'post', path: '/projects/{id}/content-map/approve', summary: 'Aprova o mapa (grava approved_at)', tag: 'Projetos', auth: 'creator', scope: 'content:write' },

  // ─────────── Interações (RF-02) ───────────
  { method: 'post', path: '/projects/{id}/interactions/generate', summary: 'Gera interações; retorna job_id', tag: 'Interações', auth: 'creator', scope: 'ai:invoke', requestSchema: generateSchema, successStatus: 202 },
  { method: 'get', path: '/projects/{id}/interactions', summary: 'Lista interações do projeto', tag: 'Interações', auth: 'creator', scope: 'content:read' },
  { method: 'patch', path: '/interactions/{id}', summary: 'Edita interação (payload validado pelo schema do tipo)', tag: 'Interações', auth: 'creator', scope: 'content:write', requestSchema: editInteractionSchema },
  { method: 'delete', path: '/interactions/{id}', summary: 'Exclui interação', tag: 'Interações', auth: 'creator', scope: 'content:write' },
  { method: 'post', path: '/interactions/{id}/regenerate', summary: 'Regenera uma interação específica', tag: 'Interações', auth: 'creator', scope: 'ai:invoke', successStatus: 202 },

  // ─────────── Estúdio e publicação (RF-03, RF-04) ───────────
  { method: 'get', path: '/templates', summary: 'Catálogo de templates', tag: 'Estúdio', auth: 'creator', scope: 'design:read' },
  { method: 'get', path: '/palettes', summary: 'Catálogo de paletas', tag: 'Estúdio', auth: 'creator', scope: 'design:read' },
  { method: 'get', path: '/projects/{id}/theme', summary: 'Lê o tema do projeto', tag: 'Estúdio', auth: 'creator', scope: 'design:read' },
  { method: 'put', path: '/projects/{id}/theme', summary: 'Aplica template/paleta/tipografia/efeitos', tag: 'Estúdio', auth: 'creator', scope: 'design:write', requestSchema: setThemeSchema },
  { method: 'post', path: '/projects/{id}/theme/from-logo', summary: 'Extrai paleta da cor da marca', tag: 'Estúdio', auth: 'creator', scope: 'design:write', requestSchema: fromLogoSchema },
  { method: 'put', path: '/projects/{id}/access', summary: 'Define o modo de acesso (público/link/senha/convite)', tag: 'Estúdio', auth: 'creator', scope: 'design:write', requestSchema: setAccessSchema },
  { method: 'post', path: '/projects/{id}/publish', summary: 'Publica nova versão (manifesto imutável + SHA-512)', tag: 'Estúdio', auth: 'creator', scope: 'publish', idempotencyKey: true, successStatus: 201, successDescription: 'Versão publicada: version_number, url e bundle_sha512.' },
  { method: 'post', path: '/projects/{id}/rollback', summary: 'Reverte para a versão informada', tag: 'Estúdio', auth: 'creator', scope: 'publish', requestSchema: rollbackSchema },
  { method: 'get', path: '/projects/{id}/versions', summary: 'Histórico de versões', tag: 'Estúdio', auth: 'creator', scope: 'projects:read' },

  // ─────────── Analytics (RF-11) ───────────
  { method: 'get', path: '/projects/{id}/analytics/summary', summary: 'Sessões, conclusão e funil (janela from/to)', tag: 'Analytics', auth: 'creator', scope: 'analytics:read', querySchema: dateRangeSchema },
  { method: 'get', path: '/projects/{id}/analytics/heatmap', summary: 'Mapa de dificuldade (erro por interação)', tag: 'Analytics', auth: 'creator', scope: 'analytics:read', querySchema: dateRangeSchema },

  // ─────────── Aprendizes (RF-05) ───────────
  { method: 'get', path: '/projects/{id}/learners', summary: 'Lista aprendizes matriculados', tag: 'Aprendizes', auth: 'creator', scope: 'learners:read' },
  { method: 'post', path: '/projects/{id}/learners/invite', summary: 'Convida aprendiz (modo invite)', tag: 'Aprendizes', auth: 'creator', scope: 'learners:write', requestSchema: inviteSchema },

  // ─────────── INPI (RF-16, RF-17) ───────────
  { method: 'post', path: '/projects/{id}/inpi/package', summary: 'Gera o Pacote INPI da versão; retorna job_id', tag: 'INPI', auth: 'creator', scope: 'inpi:write', requestSchema: generatePackageSchema, idempotencyKey: true, successStatus: 202 },
  { method: 'get', path: '/projects/{id}/inpi/certificates', summary: 'Certificações INPI do projeto', tag: 'INPI', auth: 'creator', scope: 'inpi:read' },
  { method: 'get', path: '/inpi/certificates/{id}', summary: 'Hash e links do ZIP/Declaração', tag: 'INPI', auth: 'creator', scope: 'inpi:read' },
  { method: 'post', path: '/inpi/certificates/{id}/verify', summary: 'Recalcula e confere o hash (auditado)', tag: 'INPI', auth: 'creator', scope: 'inpi:read', idempotencyKey: true },
  { method: 'get', path: '/inpi/filings/pricing', summary: 'Preço do Registro Assistido (honorários + GRU 730)', tag: 'INPI', auth: 'creator', scope: 'inpi:read' },
  { method: 'get', path: '/inpi/filings', summary: 'Meus pedidos de Registro Assistido', tag: 'INPI', auth: 'creator', scope: 'inpi:read' },
  { method: 'post', path: '/inpi/filings', summary: 'Abre pedido de Registro Assistido (RF-17)', tag: 'INPI', auth: 'creator', scope: 'inpi:write', requestSchema: contractFilingSchema, idempotencyKey: true, successStatus: 201 },
  { method: 'get', path: '/inpi/filings/{id}', summary: 'Status + linha do tempo do pedido', tag: 'INPI', auth: 'creator', scope: 'inpi:read' },
  { method: 'patch', path: '/inpi/filings/{id}/data', summary: 'Dados guiados de titularidade/autoria', tag: 'INPI', auth: 'creator', scope: 'inpi:write', requestSchema: submitDataSchema },
  { method: 'post', path: '/inpi/filings/{id}/poa/upload-url', summary: 'URL pré-assinada para a procuração assinada', tag: 'INPI', auth: 'creator', scope: 'inpi:write' },
  { method: 'post', path: '/inpi/filings/{id}/poa/confirm', summary: 'Confirma a procuração (validação PAdES)', tag: 'INPI', auth: 'creator', scope: 'inpi:write', requestSchema: confirmPoaSchema, idempotencyKey: true },
  { method: 'post', path: '/inpi/filings/{id}/payment', summary: 'Confirma o pagamento', tag: 'INPI', auth: 'creator', scope: 'inpi:write', idempotencyKey: true },
  { method: 'post', path: '/inpi/filings/{id}/revoke', summary: 'Revoga a procuração/pedido', tag: 'INPI', auth: 'creator', scope: 'inpi:write' },

  // ─────────── Créditos (B.2) ───────────
  { method: 'get', path: '/credits/balance', summary: 'Saldo de créditos de IA', tag: 'Créditos', auth: 'creator', scope: 'billing:read' },
  { method: 'get', path: '/credits/ledger', summary: 'Extrato de créditos de IA', tag: 'Créditos', auth: 'creator', scope: 'billing:read' },

  // ─────────── API keys (B.1) ───────────
  { method: 'get', path: '/api-keys/scopes', summary: 'Catálogo de escopos disponíveis', tag: 'API keys', auth: 'creator' },
  { method: 'get', path: '/api-keys', summary: 'Lista minhas API keys', tag: 'API keys', auth: 'creator' },
  { method: 'post', path: '/api-keys', summary: 'Cria API key (o valor é exibido uma única vez)', tag: 'API keys', auth: 'creator', requestSchema: createApiKeySchema, successStatus: 201 },
  { method: 'delete', path: '/api-keys/{id}', summary: 'Revoga uma API key', tag: 'API keys', auth: 'creator' },

  // ─────────── Webhooks (B.4) ───────────
  { method: 'get', path: '/webhooks/events', summary: 'Catálogo de eventos de webhook', tag: 'Webhooks', auth: 'creator' },
  { method: 'post', path: '/webhooks', summary: 'Cria endpoint de webhook (conta ou projeto)', tag: 'Webhooks', auth: 'creator', requestSchema: createWebhookSchema, successStatus: 201 },
  { method: 'get', path: '/webhooks', summary: 'Lista meus endpoints de webhook', tag: 'Webhooks', auth: 'creator' },
  { method: 'patch', path: '/webhooks/{id}', summary: 'Atualiza endpoint (url/eventos/ativo)', tag: 'Webhooks', auth: 'creator', requestSchema: updateWebhookSchema },
  { method: 'delete', path: '/webhooks/{id}', summary: 'Remove endpoint de webhook', tag: 'Webhooks', auth: 'creator' },
  { method: 'get', path: '/webhooks/{id}/deliveries', summary: 'Entregas recentes do endpoint', tag: 'Webhooks', auth: 'creator' },
  { method: 'post', path: '/webhooks/deliveries/{deliveryId}/redeliver', summary: 'Reentrega manual de um evento', tag: 'Webhooks', auth: 'creator' },

  // ─────────── App publicado e aprendiz (RF-04, RF-05) ───────────
  { method: 'get', path: '/public/apps/{slug}', summary: 'Manifesto do app publicado (respeita modo de acesso)', tag: 'Runtime', auth: 'public' },
  { method: 'post', path: '/learner/signup', summary: 'Conta leve de aprendiz', tag: 'Runtime', auth: 'public', requestSchema: learnerSignupSchema, successStatus: 201 },
  { method: 'post', path: '/learner/login', summary: 'Login do aprendiz', tag: 'Runtime', auth: 'public', requestSchema: learnerLoginSchema },
  { method: 'get', path: '/learner/me', summary: 'Sessão atual do aprendiz', tag: 'Runtime', auth: 'learner' },
  { method: 'post', path: '/learner/logout', summary: 'Logout do aprendiz', tag: 'Runtime', auth: 'learner' },
  { method: 'post', path: '/public/apps/{slug}/enroll', summary: 'Matrícula no app (senha/convite conforme o modo)', tag: 'Runtime', auth: 'learner', requestSchema: enrollSchema },
  { method: 'get', path: '/public/enrollments/{id}/progress', summary: 'Progresso consolidado da matrícula', tag: 'Runtime', auth: 'learner' },
  { method: 'get', path: '/public/enrollments/{id}/achievements', summary: 'Conquistas do aprendiz (8 conquistas, RF-06.7)', tag: 'Runtime', auth: 'learner' },
  { method: 'post', path: '/public/enrollments/{id}/events', summary: 'Registra evento de aprendizagem (XP, streak, SM-2)', tag: 'Runtime', auth: 'learner', requestSchema: recordEventSchema },
  { method: 'get', path: '/public/apps/{slug}/leaderboard', summary: 'Ranking do app (top 10 XP, nome abreviado)', tag: 'Runtime', auth: 'public' },
  { method: 'get', path: '/public/certificates/{code}/verify', summary: 'Verificação pública de certificado', tag: 'Runtime', auth: 'public' },
  { method: 'get', path: '/public/certificates/{code}/pdf', summary: 'Download do certificado (URL pré-assinada)', tag: 'Runtime', auth: 'public' },

  // ─────────── Sensei (RF-06.1) ───────────
  { method: 'get', path: '/projects/{id}/sensei', summary: 'Lê a config do Sensei (nome, avatar, tom)', tag: 'Sensei', auth: 'creator', scope: 'projects:read' },
  { method: 'put', path: '/projects/{id}/sensei', summary: 'Atualiza a config do Sensei', tag: 'Sensei', auth: 'creator', scope: 'projects:write', requestSchema: senseiConfigSchema },
  { method: 'get', path: '/public/apps/{slug}/sensei', summary: 'Config pública do Sensei + flag indexed (runtime)', tag: 'Runtime', auth: 'public' },
  { method: 'post', path: '/public/enrollments/{id}/sensei/ask', summary: 'Pergunta do aprendiz ao Sensei (RAG com citação)', tag: 'Runtime', auth: 'learner', requestSchema: askSenseiSchema },

  // ─────────── Mídia (RF-06.5) ───────────
  { method: 'post', path: '/projects/{id}/chapters/{chapterId}/podcast', summary: 'Gera podcast do capítulo (áudio WAV)', tag: 'Mídia', auth: 'creator', scope: 'content:write', successStatus: 202 },
  { method: 'post', path: '/projects/{id}/chapters/{chapterId}/illustration', summary: 'Gera ilustração IA do capítulo (SVG)', tag: 'Mídia', auth: 'creator', scope: 'content:write', successStatus: 201 },
  { method: 'get', path: '/projects/{id}/media', summary: 'Lista mídia do projeto (URLs pré-assinadas)', tag: 'Mídia', auth: 'creator', scope: 'projects:read' },
  { method: 'get', path: '/public/apps/{slug}/media', summary: 'Mídia pública do app (podcast, ilustrações)', tag: 'Runtime', auth: 'public' },
];
