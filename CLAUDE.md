# CLAUDE.md — Memória de Trabalho do EduForge

> Memória entre sessões (PRD §0.1.4). Fonte da verdade do produto: [`PRD.md`](./PRD.md).
> Decisões de arquitetura: [`docs/DECISIONS.md`](./docs/DECISIONS.md).

## O que é

EduForge: de um PDF a um app de aprendizagem (PWA) publicado em < 30 min, via pipeline de IA.
Monorepo TypeScript com 5 apps e 6 pacotes.

## Stack (decidida — PRD §0.2, não reabrir)

| Camada | Escolha |
| --- | --- |
| Linguagem | TypeScript estrito |
| Monorepo | pnpm workspaces + Turborepo |
| Painéis | Next.js 14 (App Router) — `apps/web`, `apps/admin` |
| API | NestJS 10 + Fastify — `apps/api`, REST `/v1` |
| Runtime | Vite 5 + React 18 PWA — `apps/runtime` |
| Jobs | BullMQ + Redis — `apps/worker` |
| Banco | PostgreSQL 16 + pgvector + Prisma 5 |
| Arquivos | S3 (MinIO local) |
| Validação | Zod nas bordas |
| Build de pacotes | tsup (CJS+ESM+dts) |
| Testes | Vitest (Supertest/Playwright nas próximas milestones) |
| UI | Tailwind CSS |

## Estrutura

```
apps/
  web/       painel do criador (Next, :3000)
  admin/     admin console (Next, :3001)
  api/       NestJS REST /v1 (:3333, health em /health)
  worker/    BullMQ (:3334, health em /health)
  runtime/   PWA do app publicado (Vite, :5173)
packages/
  config/    env (Zod) + constantes + loadRootEnv
  db/        Prisma schema + migrations + seeds (client singleton)
  schemas/   Zod das interações (envelope Parte 6.A)
  ai/        AiProvider + MockAiProvider (+ factory)
  ui/        tokens de design (paletteToCssVars)
  testing/   fixtures + factories
docs/DECISIONS.md
```

## Comandos

| Comando | O quê |
| --- | --- |
| `pnpm install` | instala o workspace |
| `pnpm docker:up` / `docker:down` / `docker:reset` | infra local (Postgres, Redis, MinIO) |
| `pnpm dev` | sobe todos os apps (Turbo) |
| `pnpm verify` | lint + typecheck + test (CI local) |
| `pnpm build` | build de tudo |
| `pnpm db:reset` | recria o banco do zero + seed |
| `pnpm db:migrate` | cria/aplica migração (dev) |
| `pnpm db:seed` / `db:studio` | seed / Prisma Studio |
| `pnpm test:e2e` | Playwright (aprendiz no runtime) — exige stack no ar |
| `pnpm test:api` | coleção Supertest do fluxo B.3 via API key — exige api+worker+docker |

Requer Docker Desktop rodando antes de `docker:up`/`db:reset`.

## Convenções (PRD §0.6)

- Commits convencionais referenciando milestone e RF: `feat(m3): quiz schema [RF-02]`.
- Uma feature = código + teste + migração no mesmo commit lógico.
- Tabelas/colunas em `snake_case` (via `@map`/`@@map`); UI e textos em pt-BR (i18n na M1+).
- Erros da API no formato Problem Details (Parte 6.B.5) — a partir da M1.
- Validação Zod em toda borda; imutabilidade onde o PRD exige (manifest, inpi, audit, ledger).
- `// TODO(prd:RF-xx):` para qualquer requisito adiado — sem placeholder silencioso.

## Contas de seed

- Admin: `admin@eduforge.app` / `EduForge!Admin1` (role `admin`, e-mail verificado, sem MFA → forçado a configurar no admin console).
- Criadora: `marina@exemplo.com` / `EduForge!2026` (role `creator`) — assinatura Free + 500 créditos.

## Estado das Milestones

- [x] **M0 — Fundação.** Monorepo, docker-compose (pg+pgvector, redis, minio+buckets), Prisma
      com schema completo (32 tabelas: Parte 2 + INPI Parte 5 + `palettes`), seeds (2 usuários,
      3 planos, 4 templates, 15 paletas), `pnpm verify` verde (36 tasks), `pnpm db:reset` OK,
      `pnpm dev` sobe os 5 apps, healthchecks de api (db up) e worker (redis up) OK.
- [x] **M1 — Auth e RBAC (RF-07).** Auth em arquitetura hexagonal (domínio puro + ports +
      adapters Prisma/Redis/BullMQ). Cadastro (consentimento LGPD), verificação de e-mail
      (mailer console), login, MFA TOTP (setup/enable/backup codes), refresh rotativo,
      logout, "sair de todos", recuperação de senha, bloqueio progressivo (5→CAPTCHA,
      10→bloqueio 15 min), guards `@Roles`/JWT/AdminMfa, Problem Details (RFC 9457), Zod nas
      bordas, LGPD (export + exclusão→anonimização no worker). Frontend: web login/cadastro/
      painel + admin login/gate de MFA, ambos com next-intl (pt-BR). **10 cenários Gherkin
      do Épico 5 como testes + 19 checks de smoke ao vivo + gate de MFA validado no browser.**
      Rotas: `POST /v1/auth/{signup,verify-email,login,login/mfa,refresh,logout,logout-all,
      password/forgot,password/reset}`, `GET /v1/auth/me`, `/v1/auth/mfa/{setup,enable,disable}`,
      `/v1/account/{export,delete}`.
- [x] **M2 — Projetos e ingestão (RF-01).** Upload via URL pré-assinada (MinIO), fila `ingest`
      (extração `unpdf`/`mammoth` → estruturação `AiProvider` → classificação) com progresso
      persistido por etapa, OCR atrás de `OcrProvider` (mock; tesseract TODO), Mapa de Conteúdo
      editável (árvore capítulos→seções, renomear + drag-and-drop de seção) e aprovação. Rotas:
      `POST /v1/projects`, `GET /v1/projects[/:id]`, `POST /v1/projects/:id/source-files`,
      `POST /v1/source-files/:id/ingest`, `GET /v1/jobs/:id`,
      `GET|PUT /v1/projects/:id/content-map`, `POST .../content-map/approve`. Frontend web:
      `/novo` (wizard upload + progresso) e `/projeto/:id/mapa` (revisão do mapa). **18 testes
      (US-ING-01/02) + smoke ao vivo de 12 checks com PDF real de 150 páginas + UI validada no
      browser** (mapa com dados reais, renomeação e aprovação persistidas).
- [x] **M3 — Interações (RF-02 + Parte 6.A).** Os 9 tipos em `packages/schemas` (Zod +
      regras semânticas + `validateInteraction`), geração via fila com validação e retry (2×),
      seção "pendente" quando persiste inválido, CRUD + regeneração, débito em
      `ai_credit_ledger` (saldo = SUM(delta)). Rotas: `POST /v1/projects/:id/interactions/generate`,
      `GET /v1/projects/:id/interactions`, `PATCH|DELETE /v1/interactions/:id`,
      `POST /v1/interactions/:id/regenerate`, `GET /v1/credits/{balance,ledger}`. Frontend web:
      `/projeto/:id/interacoes` (curadoria: gerar por densidade, regenerar, editar, excluir).
      **~60 testes (incl. 9 tipos válidos + inválidos + property "nenhum payload inválido
      persiste") + smoke ao vivo 17/17 + UI validada no browser** (créditos debitados, "editado").
- [x] **M4 — Estúdio e runtime (RF-03, RF-04).** 4 templates + paletas com **verificação WCAG AA
      programática** (`packages/ui`), paleta da marca + modo escuro automático, `manifest.json`
      **imutável** + hash **SHA-512** canônico (reprodutível), publicação → runtime `/:slug`,
      rollback, modos de acesso (público/link/senha), PWA (manifesto + SW + ícone). Rotas:
      `GET /v1/{templates,palettes}`, `GET|PUT /v1/projects/:id/theme`, `POST .../theme/from-logo`,
      `PUT .../access`, `POST .../publish`, `POST .../rollback`, `GET .../versions`,
      `GET /v1/public/apps/:slug`. Frontend: web `/projeto/:id/visual` (estúdio) + runtime
      `/:slug` (app publicado temático). **~50 testes (WCAG, publish/rollback/senha, trocar
      template preserva conteúdo) + smoke ao vivo 17/17 (hash reprodutível!) + runtime no browser.**
- [x] **M5 — Experiência do aprendiz (RF-05).** Conta leve de learner (JWT próprio,
      sem MFA/refresh — ADR-0036), matrícula (`enroll`) respeitando os modos de acesso
      (público/link/senha/convite), **execução real dos 9 tipos de interação no
      runtime** (grading puro em `packages/schemas`), `learning_events`, progresso por
      bloco, XP, streak com proteção (1 congelamento/semana), **SM-2 real** dos
      flashcards (granularidade por bloco — ADR-0037), certificado PDF com QR
      (`pdf-lib`+`qrcode`) emitido automaticamente + verificação pública + download via
      URL pré-assinada. Rotas: `POST /v1/learner/{signup,login,logout}`, `GET /v1/learner/me`,
      `POST /v1/public/apps/:slug/enroll`, `GET /v1/public/enrollments/:id/progress`,
      `POST /v1/public/enrollments/:id/events`, `GET /v1/public/certificates/:code/{verify,pdf}`,
      `GET /v1/projects/:id/learners`, `POST .../learners/invite`. Frontend runtime: telas de
      auth/senha/certificado + 9 componentes interativos (`apps/runtime/src/interactions`).
      Seed determinístico "Biologia Viva Demo" (`biologia-viva-demo`, já publicado, os 9 tipos)
      para testes. **~62 testes novos (sm2/mastery/streak/grading/serviços) + smoke ao vivo
      28/28 (créditos, isolamento entre aprendizes, PDF real do MinIO) + E2E Playwright real
      (`pnpm test:e2e`, 2 execuções estáveis) + validação manual no browser.**
- [x] **M6 — Painéis (RF-08 a RF-15).** Backend: DB endurecido com role restrita
      `eduforge_app` (imutabilidade de `audit_logs`/`app_versions`/`ai_credit_ledger`/
      `inpi_certificates` a nível de permissão — ADR-0043); AdminModule (gestão de
      usuários: suspender/reativar/revogar sessões/forçar reset de senha/conceder
      créditos/impersonar, tudo auditado; feature flags com rollout % determinístico
      por hash + fixação por usuário/org/plano — ADR-0044); CreatorModule (home
      agregada, analytics de aprendizagem: sessões, usuários ativos, conclusão por
      capítulo, funil de abandono, mapa de dificuldade + CSV). Rotas: `GET|POST
      /v1/admin/users[/:id/{suspend,reactivate,force-password-reset,revoke-sessions,
      credits,impersonate,audit-logs}]`, `GET|POST|PUT /v1/admin/feature-flags[/:key
      [/pin]]`, `POST /v1/auth/impersonate/consume`, `GET /v1/me/home`, `GET
      /v1/projects/:id/analytics/{summary,heatmap,heatmap.csv}`. Frontend: wizard
      reordenado para bater com RF-09 (upload→mapa→visual→interações→
      **revisão e publicação**, novo passo 5 — ADR-0045); home do criador redesenhada
      (miniatura por cor do tema, status incl. "atualização pendente", uso do plano,
      destaques); páginas de analytics e configurações (perfil, MFA, sessões,
      exportar/excluir dados LGPD) no app web; admin ganhou `/usuarios[/:id]` (busca,
      360º, ações, trilha de auditoria) e `/flags` (CRUD + slider de rollout + fixar
      por sujeito); banner de "sessão de suporte" global no app web durante
      impersonação (ADR-0046, com ressalva de cookie compartilhado documentada).
      **42 testes novos (admin + creator, incl. verificação estatística de rollout)
      + monorepo completo verde (38/38 tasks) + fluxo ponta a ponta validado no
      browser: suspender c/ trilha, conceder créditos, impersonar com banner e
      encerrar sessão, feature flag com slider, MFA na página de configurações,
      wizard completo dos 5 passos, analytics com dados reais.**
- [x] **M7 — INPI (RF-16, Parte 5).** Pacote canônico **determinístico**
      (`apps/worker/src/inpi`): `archiver` com data/modo fixos por entrada +
      PDFs (`pdf-lib`) com `CreationDate` fixo (ADR-0048), `01-codigo-fonte/`
      (manifesto + interações + tema + trechos do runtime), `02-telas/`
      (Playwright headless real, mobile/desktop × claro/escuro — corrigiu um
      bug real do modo escuro no runtime, ADR-0050), `03-memorial-descritivo/`
      (gerado via `AiProvider.generateMemorial`), `MANIFEST-FILES.txt` (SHA-256
      por arquivo) e `METADATA.json`. Hash **SHA-512** (+SHA-256 de conferência)
      gravado em `inpi_certificates`, ZIP + Declaração de Integridade
      congelados no bucket WORM dedicado (`S3_BUCKET_WORM`). Ficha de Registro
      compartilhada entre worker e API via `packages/schemas` (ADR-0049).
      Verificação de integridade sob demanda é log append-only
      (`inpi_certificate_verifications`, ADR-0053). `Idempotency-Key`
      obrigatória nas rotas novas via `IdempotencyInterceptor` (Redis,
      ADR-0052). Rotas: `POST /v1/projects/:id/inpi/package`, `GET
      /v1/projects/:id/inpi/certificates`, `GET /v1/inpi/certificates/:id`,
      `POST /v1/inpi/certificates/:id/verify`. Frontend web:
      `/projeto/:id/inpi` (tela C.4 — versão, gerar pacote, hash com copiar,
      downloads, Ficha de Registro, verificar integridade, avisos RF-16.5,
      card "Registro Assistido" desabilitado/M8). **Teste de reprodutibilidade
      do DoD (gerar 2×, comparar SHA-512) verde + ~15 testes novos (worker +
      api) + monorepo completo verde (38/38) + E2E Playwright verde após a
      correção do modo escuro + smoke ao vivo real**: pacote gerado de ponta a
      ponta pelo app demo (ZIP de 26 arquivos com as 4 telas reais, memorial.pdf
      correto, hash verificado como íntegro no browser).
- [x] **M8 — Registro Assistido (RF-17, Parte 5 §3).** Fluxo completo com a
      EduForge como procuradora: contratação a partir de uma certificação
      RF-16 (preço decomposto honorários+GRU 730), coleta guiada de
      titularidade/autoria, verificação de pré-requisito (certificado
      ICP-Brasil) com orientação quando ausente, upload de procuração com
      validação real de assinatura PAdES (`scanForPadesMarkers`, regra
      PJ→e-CNPJ — ADR-0054/0055), pagamento (mock), fila operacional no admin
      (checklist com 4 itens derivados + 2 manuais, protocolo, registro manual
      de despacho da RPI, entrega do Certificado — ADR-0057), revogação a
      qualquer tempo até a concessão. Toda ação do operador audita via
      `AuditService` do M6 (ADR-0058). Máquina de estados como predicados
      puros (ADR-0054); upload de PDFs via URL pré-assinada, mesmo padrão do
      M2 (ADR-0056). Rotas: `GET /v1/inpi/filings/pricing`, `GET|POST
      /v1/inpi/filings[/:id]`, `PATCH .../data`, `POST .../poa/{upload-url,
      confirm}`, `POST .../payment`, `POST .../revoke`; admin: `GET
      /v1/admin/inpi/filings[/:id]`, `POST .../claim`, `PATCH .../checklist`,
      `POST .../{protocol,rpi-event,certificate/upload-url,grant,reject}`.
      Frontend: web `/projeto/:id/inpi` (card "Registro Assistido" habilitado)
      + `/projeto/:id/inpi/assistido/:filingId` (formulário guiado → upload de
      procuração → pagamento → linha do tempo C.5 com dossiê); admin `/inpi`
      (fila C.6 com alerta de SLA) + `/inpi/:filingId` (checklist, protocolo,
      RPI, concessão). **~35 testes novos cobrindo os 6 cenários Gherkin da
      Parte 5 §3.5 + monorepo completo verde (38/38) + fluxo ponta a ponta
      real no browser**: contratação → dados → procuração assinada (PAdES
      real via MinIO) → pagamento → fila do admin → checklist → protocolo →
      evento de RPI → certificado entregue → dossiê completo com os 3
      documentos no lado do criador.
- [x] **M9 — API pública + webhooks (Parte 6.B).** API keys `efk_live_/efk_test_`
      (hash+pepper, exibidas uma vez, escopos B.2 com wildcard `ns:*`, revogação
      criador/admin) autenticando as MESMAS rotas via segundo `APP_GUARD`
      (sessão OU Bearer — ADR-0059); rate limit 120 req/min por chave (janela
      fixa Redis, headers `X-RateLimit-*`, 429 + `Retry-After`);
      `Idempotency-Key` obrigatória em `/publish` (retrofit) com replay.
      Webhooks (B.4): CRUD por conta/projeto, segredo AES-256-GCM
      (`packages/schemas/crypto` — worker decifra p/ assinar, ADR-0060),
      entrega assinada `X-EduForge-Signature: t=,v1=` (HMAC-SHA256, anti-replay
      5 min) pela fila `webhook-delivery` com ~24h de retry exponencial (13
      tentativas, cap 4h — ADR-0061), toda tentativa em `webhook_deliveries`,
      reentrega manual. Os 9 pontos de disparo (12 eventos) wired best-effort
      (ADR-0062): api (publish/rollback/enroll/completed/milestone/certificate/
      filing-status) + worker nos wrappers dos jobs (ingest, generate, inpi,
      credits.low_balance só na travessia do limiar). OpenAPI 3.1 em
      `/v1/openapi.json` derivado dos Zod DTOs via registro declarativo
      (zod-to-json-schema, sem @nestjs/swagger — ADR-0063). Rotas novas:
      `GET|POST /v1/api-keys[/{id}]`, `GET /v1/api-keys/scopes`,
      `GET|POST|PATCH|DELETE /v1/webhooks[/{id}]`, `GET /v1/webhooks/events`,
      `GET .../deliveries`, `POST /v1/webhooks/deliveries/{id}/redeliver`,
      `GET /v1/openapi.json`. Frontend: `/configuracoes/api` (chaves com
      exibição única + copiar, webhooks com gerador de segredo, entregas e
      reentrega). **Coleção Supertest B.3 ponta a ponta via API key
      (`pnpm test:api`, 14/14 contra api+worker+MinIO reais — ADR-0064) +
      ~100 testes novos + monorepo verde (38/38) + smoke ao vivo: publish →
      entrega assinada verificada criptograficamente no receptor local +
      ingest.completed/interactions.generated/app.published entregues durante
      a própria coleção B.3 + UI validada no browser.**
- [x] **M10 — Diferenciais Fase 2 (RF-06.x).** Sensei/RAG com pgvector (portão
      de citação estrutural — ADR-0066), TTS/podcast com dois apresentadores
      (WAV sintetizado, fila `tts`), ilustrações IA por capítulo (SVG
      estilo-consistente com a paleta), 8 conquistas + ranking (computados
      na leitura, sem tabela nova — ADR-0067). Embedder mock lexical 1536d
      calibrado com 20 perguntas de avaliação (ADR-0065). Mídia pós-publicação
      em `media_assets`, fora do manifesto imutável (ADR-0068). RF-06.2/3/4/6/8
      diferidos para Fase 3 (ADR-0069). Rotas: `GET|PUT /v1/projects/:id/sensei`,
      `GET /v1/public/apps/:slug/sensei`, `POST /v1/public/enrollments/:id/sensei/ask`,
      `POST /v1/projects/:id/chapters/:chapterId/{podcast,illustration}`,
      `GET /v1/{projects/:id,public/apps/:slug}/media`,
      `GET /v1/public/enrollments/:id/achievements`,
      `GET /v1/public/apps/:slug/leaderboard`.
      Custos novos: `costTutorQuestion: 1`, `costPodcast: 5`, `costIllustration: 2`.
      **~60 testes novos (sensei: 44, podcast: 3, achievements: 9) + typecheck
      limpo em api/worker + runtime SenseiPanel + web /sensei.**

## Notas para a próxima sessão

- `packages/schemas` tem os 9 tipos + `validateInteraction` (o portão anti-payload-inválido).
- `packages/ai` só tem o Mock; `AnthropicProvider` real (LLM) falha explicitamente na factory hoje.
- Interações são rascunhos (`app_version_id` null) até a publicação (M4). Créditos: SUM(delta).
- `learning_events` não é particionada ainda (ADR-0007); dimensão do `vector` é provisória (ADR-0008).
- Migração via `prisma migrate diff` (o `migrate dev` interativo trava em shell não-TTY).
  Novas migrações: `pnpm db:migrate` em terminal interativo, ou `diff` + `db:reset`.
- **Auth (M1):** login social, magic link, SSO e CAPTCHA/HIBP reais estão diferidos (ADR-0018).
  O e-mail de verificação/reset é logado no console (MAILER=console) — pegue o link no stdout da API.
- **Rodar os painéis:** a API precisa estar no ar (:3333); `web` em :3000 e `admin` em :3001
  (a allowlist de CORS/cookies da API usa exatamente essas origens). Novos env:
  `AUTH_ENCRYPTION_KEY` (cifra o secret TOTP), `NEXT_PUBLIC_API_URL` e (M6)
  `NEXT_PUBLIC_WEB_APP_URL` (usada pelo admin para montar o link de impersonação).
- **Cuidado com `node dist/main.js` (api) / `node dist/index.mjs` (worker) esquecidos rodando:**
  não pegam módulos novos (não é watch) — se uma rota nova retornar 404 "inexplicável",
  confira `Get-CimInstance Win32_Process -Filter "ProcessId = <pid>"` no PowerShell para
  ver se o processo na porta é um `dist/` antigo, e troque por `nest start --watch`/
  `tsx watch` (que funcionaram de forma estável nesta sessão). Rebuildar `packages/db`
  (`prisma generate`) com api/worker no ar trava com `EPERM` no Windows (ADR-0047) —
  pare os dois antes de `pnpm build`/`pnpm verify` depois de mexer em `.env`.
- **M2/ingestão:** para rodar a ingestão de ponta a ponta é preciso **api + worker** no ar
  (o worker consome a fila `ingest`) e o **MinIO** (docker). PDF/DOCX/MD extraem de verdade;
  EPUB tem fallback básico e OCR usa `MockOcrProvider` (tesseract é TODO).
- **CORS de dev:** a API aceita qualquer `localhost:<porta>` em dev (ADR-0025), então os
  painéis podem rodar em porta automática se a 3000/3001 estiver ocupada.
- **M4/runtime:** o app publicado é servido em `runtime /:slug` a partir do manifesto imutável
  (`GET /v1/public/apps/:slug`). A PWA gera manifesto+SW no build; ícones PNG e auditoria
  Lighthouse ≥90 ficam como validação externa.
- **M5/aprendiz:** conclusão é **por bloco de conteúdo**, não por interação — completar UMA
  interação de um bloco fecha o bloco inteiro (ADR-0038). O servidor **confia no `correct`
  relatado pelo cliente** (sem re-validação/anti-cheat — ADR-0039), aceitável para o MVP.
  App demo seed: `biologia-viva-demo` (já publicado, marina é a dona, os 9 tipos de interação).
- **E2E Playwright:** `pnpm test:e2e` (usa `playwright.config.ts` + `e2e/`). Sobe api (:3333,
  reaproveita se já estiver rodando) e um runtime dedicado em :5180. Rode `pnpm --filter
  @eduforge/db db:reset` antes se o app demo não existir ainda.
- **M6/wizard (web):** rotas na ordem do RF-09 — `/novo` (①) → `/projeto/:id/mapa` (②) →
  `/projeto/:id/visual` (③, sem publish) → `/projeto/:id/interacoes` (④) →
  `/projeto/:id/revisar` (⑤, resumo + publicar + versões/rollback). Home (`/painel`) e
  `/configuracoes` (perfil/MFA/sessões/LGPD) e `/projeto/:id/analytics` também são M6.
- **M6/admin:** `/usuarios` (busca + 360º + ações) e `/flags` (feature flags) exigem MFA
  (o mesmo gate de M1). Se acabou de ativar o MFA na própria sessão, chame
  `POST /auth/refresh` antes de bater em endpoint MFA-gated — o cookie de acesso emitido
  no login carrega `mfa:false` até renovar (mesmo bug corrigido em `apps/admin` e
  `apps/web/configuracoes` nesta milestone; se aparecer de novo em nova tela com MFA,
  aplique o mesmo fix).
- **M7/INPI:** `apps/worker/src/inpi` monta o pacote (worker) via fila `inpi-package`;
  `apps/api/src/inpi` só orquestra (cria job, expõe hash/downloads/verify) — nunca monta o
  ZIP. Gerar o pacote exige **api + worker + runtime** no ar (o worker cria uma conta de
  aprendiz descartável e navega o runtime de verdade via Playwright para capturar telas —
  ADR-0051); sem o runtime rodando, o job falha ao tentar matricular/navegar. `playwright`
  reaproveita o Chromium já baixado para os testes E2E (mesma versão major do
  `@playwright/test` da raiz — não fixar versões divergentes). `buildFichaRegistro`/
  `buildMetadata`/`DECLARED_LANGUAGES` ficam em `packages/schemas` (não no worker) porque a
  API também precisa deles para exibir a Ficha de Registro sem regenerar o pacote
  (ADR-0049). Reprodutibilidade é testada só na camada pura (`buildInpiPackage` chamado 2×
  com buffers fixos) — não depende de Playwright/S3 no teste.
- **M8/Registro Assistido:** `apps/api/src/inpi-filing` é o módulo novo (`FilingService` lado
  do criador, `OperatorService` lado do admin — ambos sobre a MESMA `InpiFiling`/
  `InpiFilingEvent` já existentes desde o M0). Para testar o fluxo local ponta a ponta,
  lembre que **os cookies de sessão são por origem da API, não por aba** (ADR-0046) — alternar
  entre a aba do criador (`localhost:3000`) e a do admin (`localhost:3001`) faz login
  sobrescrever o cookie da outra; relogue explicitamente ao trocar de aba. Um app precisa já
  ter uma certificação RF-16 (M7) antes de conseguir contratar o Registro Assistido — gere o
  pacote autosserviço primeiro. Segredos de MFA perdidos entre sessões (não persistidos fora
  do app autenticador) podem ser limpos direto no banco em dev:
  `UPDATE users SET mfa = NULL WHERE email = '...'` — sem isso o login trava exigindo um TOTP
  que ninguém mais tem.
- **M9/API pública:** `apps/api/src/api-keys`, `src/webhooks` e `src/openapi` são os módulos
  novos; entrega fica em `apps/worker/src/webhooks` (fila `webhook-delivery`). A auth por
  chave é um segundo `APP_GUARD` (ADR-0059) — rotas novas que exigirem escopo usam o decorator
  de escopo do guard; rotas de painel continuam funcionando por cookie sem mudança. A cifra
  reversível agora mora em `packages/schemas` (`encryptSecret`/`decryptSecret` — ADR-0060);
  `apps/api/src/auth/domain/crypto.ts` só re-exporta. Para testar webhooks localmente:
  suba um receptor HTTP simples e cadastre em `/configuracoes/api` — cada entrega leva
  `x-eduforge-signature: t=<ts>,v1=<hmac>` verificável com `verifyWebhookSignature` de
  `packages/schemas`. `pnpm test:api` roda a coleção Supertest B.3 (exige api+worker+docker;
  cada execução consome ~créditos da marina em gerações — o seed dá 500). O `/v1/openapi.json`
  é montado no boot a partir de `openapi/registry.ts` — ROTA NOVA NA API PÚBLICA = entrada nova
  no registro (senão o documento mente). O aviso "Recursive reference detected" no boot é
  esperado (árvore do mapa é recursiva, degrada para `any` — ADR-0063).
- **Windows/WSL2 pode travar o Docker inteiro** (aconteceu no M9): `docker ps` responde mas
  `docker exec`/`restart` penduram e conexões TCP a containers caem com ECONNRESET; até
  `wsl --status` trava. Fix: matar Docker Desktop, `wsl --shutdown`, reabrir Docker Desktop
  (reiniciar o `WSLService` exige admin). Depois confira se TODOS os containers do compose
  voltaram — o `eduforge_redis` ficou parado numa dessas e `/health` da api continua "ok"
  (só checa o banco) enquanto qualquer rota que toca Redis (login!) pendura sem erro.
- **M10 CONCLUÍDO.** Sensei/RAG, podcast/TTS, ilustração IA e gamificação implementados.
  Ver `docs/DECISIONS.md` ADRs 0065–0069 para decisões de design.
  - **Worker do Sensei (`sensei-embed`):** indexa o RAG no publish (fire-and-forget).
  - **Worker do podcast (`tts`):** gera WAV real tocável (mock: sine 220/330Hz).
  - **Portão de citação (`enforceCitationGate`):** recusa respostas sem citação válida
    (estrutural, não confia no provider). Limiar de similaridade 0.12 calibrado com
    mock embedder; recalibrar com embedder real (ADR-0065).
  - **Mídia (`media_assets`):** podcasts e ilustrações são gerados pós-publicação,
    fora do manifesto imutável. Rotas públicas dedicadas (ADR-0068).
  - **Créditos novos:** `costTutorQuestion: 1`, `costPodcast: 5`, `costIllustration: 2`
    em `packages/config/src/constants.ts`.
  - **Frontend:** SenseiPanel no runtime (chat flutuante com citações e modos) +
    página `/projeto/:id/sensei` no web (config + geração de mídia por capítulo).
  - **Efeitos visuais:** confete (`ConfettiOverlay`), flip 3D nos flashcards, holo glow,
    `prefers-reduced-motion` em tudo. Player de áudio com velocidade variável
    (`PodcastPlayer`). AnthropicProvider real implementado com fallback mock p/ embedding/
    TTS/ilustração (API Anthropic Messages p/ tarefas textuais).
  - `docs/M10-PLANO.md` pode ser apagado.
- Ainda não há `git init` (aguardando decisão do usuário).
