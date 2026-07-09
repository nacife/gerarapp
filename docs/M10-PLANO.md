# M10 — Plano de execução e estado (retomada em caso de interrupção)

> **Propósito:** se a sessão/sistema cair no meio do M10, este arquivo permite retomar
> exatamente de onde parou. Atualize a coluna de status ao concluir cada etapa.
> Fonte da verdade do escopo: PRD linha 98 (M10) + RF-06.1/06.5/06.7 e "imagens IA".
> **DoD do M10:** o Sensei NUNCA responde sem citação; avaliação automatizada com
> 20 perguntas fixture. (Os demais RF-06.x — 06.2 DNA, 06.3 História, 06.4 Batalha,
> 06.6 Foco, 06.8 Time Capsule — estão FORA do M10, são Fase 3.)

## Como retomar (checklist de 2 minutos)

1. `docker ps` — precisa de `eduforge_postgres`, `eduforge_redis`, `eduforge_minio` UP.
   Se o Docker/WSL travar: matar Docker Desktop, `wsl --shutdown`, reabrir (ver CLAUDE.md).
   **Atenção:** `eduforge_redis` às vezes não volta sozinho — `docker start eduforge_redis`.
2. Subir api/worker: `pnpm --filter @eduforge/api dev` (:3333) e `pnpm --filter @eduforge/worker dev` (:3334).
3. Conferir o que já está pronto: rodar os testes de cada área (comandos na tabela abaixo).
   Teste verde + arquivo existente = etapa concluída; siga para a primeira não concluída.
4. Regra de ouro do Windows (ADR-0047): **parar api/worker por PID antes** de qualquer
   `prisma generate`/`pnpm build` de `packages/db` (senão EPERM na DLL). Matar por PID
   exato via `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"`.

## Estado das etapas

| # | Etapa | Status | Prova (comando/arquivo) |
|---|---|---|---|
| 34 | Migration `projects.sensei_config` + `QUEUES.senseiEmbed` | ✅ FEITO | migration `20260708200000_sensei_config` aplicada; `constants.ts` tem `senseiEmbed`; dists de config/db/ai rebuildados |
| 35 | `packages/ai`: embedTexts/tutorAnswer/podcastScript/synthesizeSpeech/generateIllustration (mocks determinísticos) | ✅ FEITO | `cd packages/ai && npx vitest run` → 17 verdes; `EMBEDDING_DIM=1536` em provider.ts |
| 36 | Domínio Sensei: portão de citação (`enforceCitationGate`) + `selectContext` | ✅ FEITO | `cd apps/api && npx vitest run src/sensei` → 8 verdes; `apps/api/src/sensei/domain/guardrails.ts` (THRESHOLD=0.12, TOP_K=4) |
| 37 | Worker fila `sensei-embed` + gatilho no publish | ✅ FEITO | worker: typecheck limpo + 29 testes verdes; publish enfileira (studio.spec "publish enfileira a indexação") |
| 38 | SenseiModule na api (config criador + ask do aprendiz) | ✅ FEITO | `npx vitest run src/sensei` → 23 verdes; typecheck limpo |
| 39 | Avaliação DoD: 20 perguntas fixture | ✅ FEITO | `npx vitest run src/sensei/evaluation` → 21 verdes (14 in + 6 out + invariante) |
| 40 | TTS/Podcast (worker fila `tts` + rotas media + player runtime) | ✅ FEITO (worker + API; runtime player → etapa 43) | `npx vitest run src/podcast` → 3 verdes; typecheck limpo; MediaModule com 3 rotas |
| 41 | Ilustração IA por capítulo (síncrona na api) | ✅ FEITO | MediaService.generateIllustration; rota `POST .../illustration`; SVG + S3 + créditos |
| 42 | Gamificação completa (conquistas + ranking + efeitos RF-06.7) | ✅ FEITO (backend; efeitos visuais → etapa 43 runtime) | `npx vitest run achievements` → 9 verdes; 2 novas rotas públicas |
| 43 | Runtime: chat do Sensei (citações + modos) | ✅ FEITO | `apps/runtime/src/sensei/SenseiPanel.tsx` (botão flutuante, chat, modos, citações, erros); typecheck limpo |
| 44 | Web: `/projeto/:id/sensei` (config + mídia por capítulo) | ✅ FEITO | `apps/web/src/app/projeto/[id]/sensei/page.tsx` (config, capítulos, podcast, ilustração); typecheck limpo |
| 45 | Smoke ao vivo + `pnpm verify` completo | ✅ FEITO (smoke 20/22 checks OK; 2 bugs corrigidos no ato) | Sensei in/out-scope ✅, podcast ✅, ilustração ✅, conquistas ✅, ranking ✅, media ✅ |
| 46 | ADRs 0065+ e CLAUDE.md (M10 [x]) | ✅ FEITO | 5 ADRs (0065–0069) + CLAUDE.md atualizado com M10 [x] |

## Decisões já tomadas (NÃO reabrir sem motivo)

- **Embedder mock lexical**: bag-of-features (palavra + trigramas) hasheada por FNV-1a em
  1536 dims, L2-normalizada (`packages/ai/src/mock.ts::mockEmbed`). Similaridade de cosseno
  real por sobreposição de vocabulário — o RAG funciona de verdade sem API. Provider real
  entra pela MESMA interface (`AiProvider.embedTexts`).
- **Portão de citação é estrutural** (`enforceCitationGate` em `apps/api/src/sensei/domain/guardrails.ts`):
  descarta citações que não apontam para blocos do contexto recuperado; resposta sem citação
  válida VIRA recusa. Não confia no provider (mock ou LLM). É o mecanismo do DoD.
- **Limiar de similaridade 0.12 / top-k 4** — calibrar na etapa 39 se a avaliação falhar
  (documentar o valor final no ADR-0065).
- **Embeddings gravados por SQL cru** (`$executeRaw ... ::vector`) porque a coluna é
  `Unsupported("vector(1536)")` — Prisma tipado não lê/escreve. Busca: `ORDER BY embedding <=> $vec`.
- **Indexação no publish** (fire-and-forget, best-effort): `StudioService.publish` →
  `SenseiEmbedEnqueuer.enqueueEmbed(projectId)` → fila `sensei-embed` no worker →
  `runSenseiEmbedding` (idempotente: só `embedding IS NULL`).
- **Conquistas/ranking SEM tabela nova**: computadas na leitura a partir do estado existente
  (xp/streak/progresso/certificado). Ranking = top 10 XP por app com nome abreviado.
- **Mídia pós-publicação fora do manifesto** (podcasts/ilustrações em `media_assets` por
  projeto+capítulo, servidas por rota pública separada) — o manifesto publicado é IMUTÁVEL,
  hash não pode mudar (RF-04/RF-16).
- **Custos em créditos** (adicionar em `AI_CREDITS` na etapa 40/41): `costTutorQuestion: 1`,
  `costPodcast: 5`, `costIllustration: 2`. Débito no ledger com os reasons já existentes
  (`tutor`, `tts`, `image`). Débito é do DONO do projeto (criador), nunca do aprendiz.

## Passo a passo detalhado das etapas pendentes

### #38 — SenseiModule na api

Arquivos em `apps/api/src/sensei/`:

1. `ports.ts`:
   - `SenseiProjectRepository`: `getOwnedProject(id, ownerUserId)`, `getSenseiConfig(projectId)`,
     `setSenseiConfig(projectId, config)`, `getProjectForEnrollment(enrollmentId, learnerId)`
     (resolve projectId + ownerUserId a partir da matrícula do aprendiz).
   - `SenseiRetrievalRepository`: `searchBlocks(projectId, vector: number[], limit: number)` →
     `{blockId, contentMd, sourceRef, similarity}[]` via `$queryRaw`:
     `1 - (embedding <=> $vec::vector) AS similarity`, só blocos do mapa APROVADO de maior
     revisão, `embedding IS NOT NULL`, `ORDER BY embedding <=> $vec LIMIT 8`.
   - `SenseiCreditsRepository`: `balance(userId)`, `debit(userId, amount, reason: 'tutor', refId)`.
   - `SenseiEventRepository`: `recordTutorQuestion(enrollmentId, detail)` (learning_events,
     event `tutor_question` — o enum LearningEventType JÁ tem o valor).
2. `dto/schemas.ts`: `senseiConfigSchema` ({name: 1..40, avatar: 1..8 (emoji), tone: enum
   formal|descontraido|motivador}), `askSchema` ({question: 3..500, mode: enum default|
   explain_different|test_me|socratic}).
3. `sensei.service.ts`:
   - `getConfig/setConfig` (dono via `getOwnedProject`, senão 404). Default:
     `{name: 'Sensei', avatar: '🤖', tone: 'formal'}`.
   - `ask(enrollmentId, learnerId, dto)`:
     a) resolve matrícula → projectId + ownerUserId (404 se não é do aprendiz);
     b) saldo do dono ≤ 0 → Problem Details 402 (mesmo `insufficientCredits` do M3);
     c) `ai.embedTexts([question])` → `retrieval.searchBlocks(projectId, vec, 8)`;
        zero linhas (nunca indexado) → 409 Problem Details `sensei-not-indexed`
        ("publique o app para indexar o conteúdo");
     d) `selectContext(chunks)` → `ai.tutorAnswer({question, mode, tone, tutorName, chunks})`
        → `enforceCitationGate(raw, contexto, tone)`;
     e) grava `learning_event` tutor_question (detail: question, refused, citations);
     f) debita 1 crédito do dono (reason tutor, refId = enrollmentId) — só quando NÃO recusou;
     g) retorna `{answer, citations: [{blockId, sourceRef}], refused, tutor: {name, avatar, tone}}`.
4. `sensei.controller.ts`: `GET|PUT /projects/:id/sensei` (sessão/chave — escopo design:read/write?
   usar projects:read/write) + `POST /public/enrollments/:id/sensei/ask` com `LearnerAuthGuard`
   (mesmo guard do enrollment.controller — ver `learning/learner-auth.guard.ts`).
5. `adapters/prisma.repositories.ts` + `testing/fakes.ts` + `sensei.spec.ts` (fluxos: config
   CRUD, ask com citação, recusa fora de escopo, 402 sem saldo, 409 não indexado, evento gravado,
   débito só em resposta não-recusada).
6. Registrar `SenseiModule` em `app.module.ts`. Rotas públicas do runtime têm CORS ok (dev
   aceita localhost:*).
7. Adicionar as rotas novas ao registro OpenAPI (`openapi/registry.ts`) — SENÃO o documento mente.

### #39 — Avaliação DoD (20 perguntas)

`apps/api/src/sensei/evaluation.spec.ts`:

1. Fixture: ~10 blocos de "Biologia" (membrana, núcleo, mitocôndria, fotossíntese, mitose,
   DNA, ecossistemas, evolução…) com `sourceRef {page}` — texto rico (2–3 frases por bloco).
2. Retrieval EM MEMÓRIA: embed todos os blocos com `MockAiProvider.embedTexts`, cosseno em JS
   (mesma matemática do pgvector) — a avaliação testa a CADEIA (embed→retrieve→answer→gate),
   não o Postgres.
3. 14 perguntas in-scope ("O que a membrana regula?", "Onde acontece a fotossíntese?"…) +
   6 out-of-scope ("Capital da Mongólia?", "Como declarar imposto de renda?"…).
4. Asserções:
   - toda in-scope: `refused === false`, `citations.length ≥ 1`, todo blockId citado ∈ contexto;
   - toda out-of-scope: `refused === true`, `citations.length === 0`;
   - propriedade global: NUNCA `refused === false && citations.length === 0` (o DoD).
5. Se alguma in-scope for recusada por limiar: ajustar pergunta para vocabulário mais próximo
   OU recalibrar `SIMILARITY_THRESHOLD` (documentar no ADR-0065). NÃO afrouxar o portão.

### #40 — TTS/Podcast

1. `AI_CREDITS.costPodcast = 5` em `packages/config/src/constants.ts` (rebuild config; API/worker
   parados se for rebuildar db também).
2. Worker `apps/worker/src/podcast/pipeline.ts`: `runPodcastGeneration({jobId, projectId, chapterId}, ports)`:
   carrega capítulo+seções do mapa aprovado (repo) → `generatePodcastScript` → `synthesizeSpeech`
   → `storage.put('media/podcasts/{projectId}/{chapterId}.wav')` → `media_assets.create({kind:
   'podcast', meta: {chapterId, title, transcript: lines, durationSec}})` → Job succeeded.
   Job usa `JobType.tts` (enum já existe). Fila: `QUEUES.tts` (já existe) — registrar Worker
   no `index.ts`. Spec da pipeline com fakes.
3. API `apps/api/src/media/` (módulo novo MediaModule): 
   - `POST /projects/:id/chapters/:chapterId/podcast` (dono; 402 sem saldo; debita 5 reason tts;
     cria Job tts + enfileira; 202 {jobId});
   - `GET /projects/:id/media` (dono; lista podcasts+ilustrações com presigned GET);
   - `GET /public/apps/:slug/media` (público/aprendiz; presigned GET; só app publicado).
4. Runtime: player no capítulo (tag `<audio>` + transcrição das falas + select velocidade
   1x/1.25x/1.5x/2x via `audio.playbackRate`).
5. OpenAPI registry + testes de serviço.

### #41 — Ilustração IA

1. `AI_CREDITS.costIllustration = 2`.
2. No MediaModule: `POST /projects/:id/chapters/:chapterId/illustration` — SÍNCRONO (mock é
   instantâneo): pega paleta do tema atual (`getTheme` do studio repo ou repo próprio) →
   `ai.generateIllustration({chapterTitle, palette: theme.palette.light, seedText})` →
   S3 `media/illustrations/{projectId}/{chapterId}.svg` (content-type image/svg+xml) →
   `media_assets {kind: ai_generated, meta: {chapterId, alt, prompt}}` → debita 2 reason image.
   Regerar substitui (upsert por projectId+chapterId via busca no meta).
3. Runtime: `<img>` no cabeçalho do capítulo quando existir (mesma listagem `GET /public/apps/:slug/media`).

### #42 — Gamificação completa

1. `apps/api/src/learning/domain/achievements.ts` (puro): `AchievementStats = {doneBlocks,
   totalBlocks, xp, streakDays, completed (bool), certificateIssued}`; catálogo ~8:
   primeiro-passo (≥1 bloco), em-ritmo (streak≥3), semana-de-fogo (streak≥7), centuriao (xp≥100),
   sabio (xp≥500), meio-caminho (≥50%), conclusao (100%), certificado (emitido). 
   `computeAchievements(stats) → {key, title, description, icon, unlocked}[]`. Spec.
2. `GET /public/enrollments/:id/achievements` (learner): monta stats do progresso existente
   (mesma lógica do getProgress) + computeAchievements.
3. `GET /public/apps/:slug/leaderboard`: top 10 enrollments por XP do projeto publicado, nome
   abreviado ("Marina S."), + `enrollmentId` para o cliente destacar o próprio.
4. Runtime: aba/tela "Conquistas" (grid com locked/unlocked) + "Ranking"; confete ao completar
   capítulo (overlay `pointer-events:none`, ~40 partículas CSS, remove após 2.5s); flashcards
   com flip 3D + classe "holo" ao dominar; TUDO atrás de
   `window.matchMedia('(prefers-reduced-motion: reduce)')` (RF-06.7).
5. OpenAPI registry para as rotas públicas novas.

### #43 — Runtime: chat do Sensei

`apps/runtime/src/sensei/SenseiPanel.tsx`: botão flutuante `{avatar} {name}` (config vem em
`GET /public/apps/:slug` — expor senseiConfig no manifesto público? NÃO: manifesto é imutável.
Expor no endpoint público de media/meta OU criar `GET /public/apps/:slug/sensei` que devolve
config atual + indexado sim/não). Painel: histórico local (useState), input, 3 chips de modo,
mensagens do tutor com citações (sourceRef.page → "p. 12"), recusa com estilo de aviso,
"digitando…" durante o POST. POST `/public/enrollments/:id/sensei/ask`. Erros 402/409 → mensagem
clara no chat.

### #44 — Web: `/projeto/:id/sensei`

Página nova no app web: card de config (nome, avatar emoji — input curto, tom radio 3 opções,
PUT ao salvar), lista de capítulos do mapa aprovado com botões "Gerar podcast (5 créditos)"
[job com polling em `/jobs/:id`] e "Gerar ilustração (2 créditos)" [síncrono, mostra thumb],
player/preview do que já existe (GET /projects/:id/media). Link para a página a partir de
`/projeto/:id/revisar` (e/ou home do projeto).

### #45 — Smoke + verify

1. Parar api/worker por PID → `pnpm verify` (38/38) → religar.
2. Fluxo real no browser: publicar demo (`biologia-viva-demo`) → aguardar job sensei-embed →
   perguntar no runtime (citação visível) → pergunta fora de escopo (recusa) → "Me teste agora"
   → gerar podcast no web → tocar no runtime (WAV audível) → gerar ilustração → ver no capítulo
   → conquistas/ranking/confete → conferir débitos no extrato de créditos.
3. `pnpm test:e2e` (Playwright) continua verde (confete é pointer-events:none, não bloqueia).
4. Avaliação 20 perguntas verde: `npx vitest run src/sensei` no apps/api.

### #46 — Documentação

ADRs (docs/DECISIONS.md, próximo número livre: 0065):
- 0065 embedder lexical mock 1536 dims + limiar calibrado pela avaliação;
- 0066 portão estrutural de citação (não confia no provider) — mecanismo do DoD;
- 0067 conquistas/ranking computados na leitura, sem tabela nova;
- 0068 mídia pós-publicação fora do manifesto imutável (media_assets + rota pública);
- 0069 escopo do M10: RF-06.2/3/4/6/8 diferidos para Fase 3 (o M10 do PRD lista só
  Sensei/TTS-podcast/imagens/gamificação).
CLAUDE.md: M10 [x] com resumo no padrão das milestones anteriores + notas da sessão
(worker precisa estar no ar para indexar; WAV do mock é tocável; custos novos em AI_CREDITS;
este arquivo M10-PLANO.md pode ser apagado ao fechar o M10).

## Estado da infra NESTE momento (última atualização: início do M10)

- api/worker: **PARADOS** (foram mortos por PID para a migration — religar ao retomar).
- web (:3000): rodando via preview; runtime (:5173) e admin (:3001): conferir.
- Receptor de webhook de teste (:8899): rodando em background (irrelevante para o M10).
- Banco: migration `sensei_config` APLICADA; seeds intactos (marina, demo `biologia-viva-demo`
  publicado até v4 pelos smokes do M9).
- Créditos da marina: ~verificar com `GET /v1/credits/balance` (os smokes do M9 consumiram
  gerações; se faltar, conceder via admin `/usuarios` → créditos, ou direto no ledger).
