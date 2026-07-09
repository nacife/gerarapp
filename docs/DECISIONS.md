# ADRs — Registro de Decisões de Arquitetura

Decisões curtas tomadas quando o PRD permitia mais de um caminho (PRD §0.1.5).

## ADR-0001 — PRD.md permanece na raiz

O PRD §0.3 sugere `docs/PRD.md`, mas o arquivo foi entregue em `./PRD.md` e é
referenciado assim. Mantido na raiz para não quebrar referências; `docs/` guarda
os ADRs. `PRD.md` segue sendo a fonte da verdade.

## ADR-0002 — pnpm instalado via npm global

`corepack` não teve permissão de escrita em `C:\Program Files\nodejs`. pnpm 9.15
foi instalado com `npm i -g pnpm@9.15.0` (grava em `%APPDATA%`).

## ADR-0003 — Tabela `palettes` adicionada ao modelo

O ER v1.1 (Parte 2) não tinha catálogo de paletas, mas RF-03/RF-13 e a rota
`GET /palettes` (Parte 6.B) o exigem, e o M0 pede seed de 15 paletas. Criada a
tabela `palettes` (catálogo curado). Fontes viram catálogo próprio numa milestone
futura, se necessário.

## ADR-0004 — Pacotes compilados (tsup), não "source packages"

Os pacotes `packages/*` são compilados com **tsup** para `dist` dual (CJS+ESM+dts)
e os apps consomem o build. Alternativa considerada: exportar TS-fonte e transpilar
no consumidor. Rejeitada porque o NestJS depende de `emitDecoratorMetadata`
(tsc/`nest build`), que conflita com a transpilação por esbuild de dependências em
TS-fonte. Ordenação garantida por `turbo` (`dependsOn: ["^build"]`).

## ADR-0005 — Lista canônica de tipos de interação = Parte 6.A

O enum do banco (`InteractionType`) espelha `INTERACTION_TYPES` de
`packages/schemas` (`quiz, flashcard_deck, cloze, dragdrop, timeline, hotspot,
scenario, audio, mindmap`). Onde a Parte 2 divergia (`flashcard`), vale a Parte 6
(precedência do PRD). Fonte única evita divergência schema↔banco.

## ADR-0006 — Stack pinada para estabilidade

Next.js 14.2 + React 18 (em vez de 15/19), NestJS 10 + Fastify, Vite 5 + React 18
no runtime, Prisma 5.22, TypeScript 5.9. Prioridade: maturidade e compatibilidade
de ecossistema no MVP.

## ADR-0007 — `learning_events` no Postgres (sem particionar ainda)

Conforme PRD §0.2, a telemetria fica no Postgres atrás de um futuro
`AnalyticsStore`. Modelada como tabela comum com índice `(enrollment_id,
occurred_at)`; particionamento nativo por dia é `TODO(prd:NFR)` para escala.

## ADR-0008 — pgvector via `Unsupported`

`content_blocks.embedding` é `Unsupported("vector(1536)")?` com o preview
`postgresqlExtensions` e `extensions = [citext, vector]`. Dimensão 1536 é
provisória — revisar ao escolher o modelo de embedding (M10).

## ADR-0009 — ioredis fixado em versão única

BullMQ trazia `ioredis` 5.10.1 e a dep direta resolvia 5.11.1, causando conflito
de tipos. Resolvido com `pnpm.overrides.ioredis = 5.10.1`.

## ADR-0010 — Carga de `.env` da raiz do monorepo

Apps de backend chamam `loadRootEnv()` (sobe diretórios até achar `.env`). Os
scripts Prisma usam `dotenv-cli -e ../../.env` pelo mesmo motivo (rodam em
`packages/db`).

## ADR-0011 — Health do worker via `node:http`

O worker expõe `/health` e `/health/ready` com um servidor HTTP mínimo, sem
puxar um framework web.

## ADR-0012 — Usuários seed sem senha no M0

Admin e creator são semeados sem `password_hash` (Argon2id + MFA chegam na M1).
Marcado `TODO(prd:RF-07)` no seed — sem placeholder silencioso (PRD §0.5.9).
**Atualizado na M1:** o seed agora define senhas de dev hasheadas (Argon2id) e
`email_verified_at`, para login imediato (admin/EduForge!Admin1, marina/EduForge!2026).

## ADR-0013 — Argon2id via @node-rs/argon2

O PRD §0.2 cita o pacote `argon2`. Usamos `@node-rs/argon2` (mesmo Argon2id,
binários pré-compilados via napi-rs) por confiabilidade de instalação no
Windows/Node 24 (o `argon2` node-gyp exige toolchain nativa). `verify()`
lê os parâmetros do próprio hash, então é interoperável.

## ADR-0014 — Auth em arquitetura hexagonal

`AuthService`/`MfaService`/`AccountService` e o domínio (hasher, TOTP, política,
lockout, tokens) são **classes puras sem decorators**, dependendo de interfaces
(`ports.ts`). Adapters Prisma/Redis/BullMQ para produção; fakes em memória nos
testes. A wiring do Nest usa `useFactory`. Resultado: os cenários Gherkin viram
testes rápidos (sem DB/HTTP), e o `verify` continua leve.

## ADR-0015 — Sessão via cookies httpOnly

Access token (JWT 15 min) e refresh token opaco rotativo (hash SHA-256+pepper no
banco) são entregues como cookies `httpOnly/sameSite=lax` (§0.5.6); o refresh fica
escopado em `path=/v1/auth`. O guard aceita também `Authorization: Bearer` (uso
por integrações/testes). `secure` liga em produção.

## ADR-0016 — Tabela `auth_tokens`

Verificação de e-mail e recuperação de senha usam tokens de uso único; criada a
tabela `auth_tokens` (hash do token, tipo, expiração, `used_at`) — não constava no
ER, mas é exigida por RF-07.

## ADR-0017 — MFA de admin em duas camadas

"Admin sem MFA barrado" (RF-07) é imposto no **backend** (`AdminMfaGuard` bloqueia
papéis administrativos sem MFA satisfeito, exceto rotas `@AllowWithoutMfa`) **e** no
**admin console** (gate que força a configuração do MFA antes de qualquer ação).

## ADR-0018 — CAPTCHA/HIBP e login social diferidos

Bloqueio progressivo modela o estado `captchaRequired` (5ª falha) e o bloqueio de
15 min (10ª), mas a verificação real de CAPTCHA e a checagem HIBP ficam atrás de
interfaces (`LocalBreachedPasswordChecker` no MVP). Login social, magic link e SSO
SAML/OIDC (§0.8) ficam para milestones futuras — `TODO(prd:RF-07)`.

## ADR-0019 — i18n com next-intl (pt-BR)

`next-intl` configurado em `web` e `admin` em modo monolíngue (pt-BR), com mensagens
em `messages/pt-BR.json`. As novas telas de auth usam chaves; as telas do M0 migram
para chaves de forma incremental (§0.5.10).

## ADR-0020 — Tabela `jobs`

`GET /jobs/{id}` (Parte 6.B) exige estado persistido de jobs assíncronos. Criada a
tabela `jobs` (type, status, project_id, ref_id, `progress` jsonb com etapas, error).
Não constava no ER v1.1. O progresso por etapa é gravado a cada passo (§0.5.5).

## ADR-0021 — Forma do Mapa de Conteúdo

A árvore (`content_maps.tree`, em `packages/schemas`) é capítulos → seções; cada
seção referencia um `content_block` por `blockId`. Os `content_blocks` ficam planos
(a hierarquia vive na árvore) com `kind`, `content_md`, `confidence` e `source_ref`.
Edição (renomear/mover) é client-side e salva nova revisão via `PUT`.

## ADR-0022 — Extração e OCR

PDF via `unpdf`, DOCX via `mammoth`, Markdown direto; EPUB tem fallback básico
(remove tags) — `TODO(prd:RF-01)` para extrator dedicado. OCR atrás da interface
`OcrProvider` com `MockOcrProvider` no MVP; `TesseractOcrProvider` (tesseract.js) é
`TODO(prd:RF-01)` — a detecção de PDF sem camada de texto já dispara o fluxo.

## ADR-0023 — Integridade do upload (SHA-256)

O cliente calcula o SHA-256 e o envia ao iniciar o upload; o worker recalcula no
download (autoritativo) e grava em `source_files.sha256`. A URL pré-assinada de PUT
não assina o `Content-Type` (evita exigir header exato do cliente).

## ADR-0024 — Worker compilado como ESM

`unpdf` é ESM-only; o build do worker passou para `--format esm` (saída
`dist/index.mjs`, `start: node dist/index.mjs`) para importar deps ESM nativamente.

## ADR-0025 — CORS de dev permissivo em localhost

Em produção, allowlist estrita (APP/ADMIN/RUNTIME base URLs). Em dev, a API aceita
qualquer `http://localhost:<porta>` — assim os painéis rodam em qualquer porta
(útil quando a 3000 está ocupada) sem quebrar cookies same-site.

## ADR-0026 — Interações são rascunhos na autoria

`interactions.app_version_id` virou nullable e ganhou `project_id` (não estava no
ER): as interações são rascunhos do projeto durante a curadoria (M3) e serão
"congeladas" no manifesto imutável ao publicar (M4). `updated_at` adicionado.

## ADR-0027 — Schemas de interação = fonte única em packages/schemas

Os 9 tipos (Parte 6.A) viram Zod + validador semântico por tipo; `validateInteraction`
é o portão único de "nenhum payload inválido persiste" (schema + semântica: quiz
single com 1 correta, paridade de gaps do cloze, grafo acíclico do scenario etc.).
`buildValidInteraction` (fixtures) é compartilhado pelo MockAiProvider e pelos testes.

## ADR-0028 — AiProvider estendido para geração

`AiProvider` ganhou `generateInteractions` + `regenerateInteraction`. O
`MockAiProvider` reusa as fixtures para emitir payloads válidos e variados; tipos que
exigem mídia (hotspot/audio) ficam fora da geração padrão (dependem de assets — M10).

## ADR-0029 — Pipeline de geração: retry, pendência e créditos

Cada interação inválida é retentada até 2× (`regenerateInteraction`); se persistir
inválida, a seção fica "pendente" (`job.progress.result.pendingBlockIds`) sem quebrar
o fluxo. Idempotente: limpa os rascunhos do projeto antes de gerar. Débito no
`ai_credit_ledger` (razão append-only, `AI_CREDITS.costPerInteraction=3`); a API
pré-checa `saldo > 0` antes de enfileirar (senão 402, sem job).

## ADR-0030 — Regeneração síncrona; saldo = SUM(delta)

Regenerar uma única interação é síncrono na API (rápido com o mock; validado com
retry). O saldo de créditos é sempre `SUM(delta)` do razão (nunca um contador mutável).

## ADR-0031 — Ponteiro de versão ativa

`Project.activeAppVersionId` (não estava no ER) indica qual versão o runtime serve.
`publish` aponta para a nova versão; `rollback` aponta para a versão-alvo. Histórico
completo preservado em `app_versions`.

## ADR-0032 — WCAG AA programático em packages/ui

`contrastRatio`, `ensureWcagAa`, `buildPaletteFromBrand`, `deriveDarkMode`
(puros, testados). A verificação cobre pares **texto/fundo** (a `primary` é fundo de
botão/acento, não texto — não entra na checagem de legibilidade).

## ADR-0033 — Manifesto imutável + hash canônico reprodutível

O `manifest.json` congela conteúdo + tema + interações na publicação. O hash
`SHA-512` é do `canonicalize` (chaves ordenadas, sem espaços) — reprodutível a
partir do manifesto armazenado (verificado ao vivo; pré-requisito do pacote INPI,
M7). As interações são copiadas para o manifesto; os rascunhos seguem editáveis.

## ADR-0034 — Runtime serve por slug via endpoint público

`GET /v1/public/apps/:slug` (@Public) entrega o manifesto da versão ativa,
respeitando o modo de acesso: `public`/`link` servem; `password` exige `?key`;
`invite` fica para a M5. O runtime (Vite) usa por padrão a API em `localhost:3333`
(CORS de dev permissivo).

## ADR-0035 — Paleta da marca por cor; PWA com ícone SVG

O Estúdio envia a cor dominante da marca (extração no browser/entrada do usuário) e
a API/`packages/ui` constrói a paleta AA. Os ícones da PWA são SVG (`icon.svg`); PNGs
192/512 e a auditoria Lighthouse ≥ 90 (que exige app servido) ficam como validação
externa — a PWA já gera manifesto + service worker no build.

## ADR-0036 — Auth do aprendiz simplificada ("conta leve")

Sem MFA, sem verificação de e-mail obrigatória, sem refresh rotativo/tabela de
sessão — um único JWT de vida longa (30 dias) em cookie `ef_learner_access`,
realm separado do creator (`LearnerAuthGuard` próprio, claims com `kind:'learner'`
no mesmo `JWT_SECRET`). Cadastro duplicado com a MESMA senha apenas autentica
(reduz fricção quando o aprendiz esquece que já tem conta). Reflete literalmente
"conta leve" do RF-04/RF-05 — paridade total com a auth do creator (M1) não é
exigida aqui.

## ADR-0037 — Granularidade do SM-2 = bloco de conteúdo

`LearnerProgress` (chave `enrollment_id + content_block_id`) ganhou `ease_factor`,
`interval_days`, `repetitions` para o SM-2. Como o schema do PRD não modela
progresso por *card* individual de flashcard (só por bloco), o SM-2 avalia o
**bloco** como unidade de revisão — uma aproximação deliberada; SM-2 por card
exigiria uma tabela nova, fora do escopo desta milestone.

## ADR-0038 — Conclusão é por bloco, não por interação

Um bloco de conteúdo conta como concluído quando QUALQUER interação sua recebe um
evento `answer`/`complete` com `detail.correct=true` (reduzido em memória sobre
`learning_events` — robusto para o volume do MVP; otimizar com índice/coluna
materializada na escala). Corolário observado no teste: como um bloco pode ter
várias interações (M3 gera 2–4 por seção), completar UMA já fecha o bloco — o
certificado pode ser emitido antes de o aprendiz tocar em todas as interações
daquele bloco. Isso é intencional (mastery por conceito, não por atividade), mas
documentado aqui porque não é óbvio à primeira vista.

## ADR-0039 — Server confia no "correct" relatado pelo cliente

O runtime calcula a correção (`@eduforge/schemas` → `gradeQuiz`, `gradeCloze` etc.)
e envia `detail.correct` no evento; o servidor NÃO re-valida a resposta em si, só
credita XP uma única vez por interação (idempotência via consulta a eventos
anteriores) e recorta o XP ao valor declarado no payload da interação (nunca o
que o cliente enviar). Sem anti-cheat de servidor nesta milestone — aceitável
para o MVP/piloto; `TODO(prd:RF-05)` se isso importar antes do GA.

## ADR-0040 — Certificado: QR + PDF real via `pdf-lib`/`qrcode`, download por URL pré-assinada

`CertificateService.issue()` gera o PDF (paisagem A4, `pdf-lib`) com QR (`qrcode`)
apontando para `{APP_BASE_URL}/verificar/{code}`, grava em `S3_BUCKET_APPS` sob
`certificates/<enrollmentId>/<code>.pdf` e cria `certificates` (WORM não exigido
aqui — diferente do INPI). Download é uma URL GET pré-assinada de 900s (mesmo
padrão do upload/manifest), não streaming direto pela API.

## ADR-0041 — Seed de app publicado determinístico para E2E

`packages/db/prisma/seedDemoApp.ts` cria "Biologia Viva Demo" (slug fixo
`biologia-viva-demo`) já publicado, com os 9 tipos de interação (uma de cada,
via `buildValidInteraction`), sem depender do worker/pipeline de IA em tempo de
teste — fixture rápida e determinística para o Playwright e para smoke scripts.
Idempotente (`skip` se o slug já existir).

## ADR-0042 — Playwright instalado e funcional neste ambiente

Ao contrário do que a experiência em outros ambientes sandbox poderia sugerir,
`npx playwright install chromium` teve acesso de rede e funcionou. Um E2E real
(`e2e/learner-journey.spec.ts`, `playwright.config.ts` na raiz, script
`pnpm test:e2e`) cobre cadastro → 6 dos 9 tipos via clique real → certificado
emitido → verificação pública → download do PDF real do MinIO. Os 3 tipos
restantes (scenario/audio/mindmap) ficam no mesmo bloco já fechado pela timeline
neste fluxo (ADR-0038) — cobertos individualmente pelos testes de `grading` e
pelo smoke de API.

## ADR-0043 — Imutabilidade de WORM imposta por role restrita de banco (M6)

`packages/db/prisma/schema.prisma` agora usa `url` (role `eduforge_app`, runtime)
e `directUrl` (role dona, só para `migrate`/`db seed`) do datasource — o padrão
dual-role do Prisma. Uma migration dedicada
(`20260707120000_db_role_immutability`) cria `eduforge_app` com
SELECT/INSERT/UPDATE/DELETE em todas as tabelas por padrão e então **revoga**
UPDATE/DELETE especificamente em `audit_logs`, `app_versions`,
`ai_credit_ledger`, `inpi_certificates` (as 4 tabelas WORM do §0.5.2). Isso
imprime a garantia de append-only no nível do SGBD — mesmo um bug de aplicação
que tentasse `UPDATE`/`DELETE` nessas tabelas falharia por permissão, não só por
convenção de código. Verificado via `psql` (grants) e via smoke de regressão
completo (7/7) provando zero regressão funcional nos fluxos de M1–M5.

## ADR-0044 — `PasswordResetTrigger`: fronteira estreita entre AdminModule e AuthModule

`AdminUsersService.forcePasswordReset` precisa disparar o fluxo de reset de
senha do auth, mas importar a classe concreta `AuthService` criaria acoplamento
desnecessário e dificultaria testar `AdminUsersService` isoladamente. Solução:
uma interface mínima `PasswordResetTrigger { requestPasswordReset(email) }`
declarada no próprio `admin-users.service.ts`; `AuthModule` exporta `AuthService`
(que já implementa esse método) e `AdminModule` importa `AuthModule`, injetando
via `useFactory`. Ganho duplo: fronteira de módulo mais limpa e testabilidade
(fake de uma linha em vez de mockar a classe inteira).

## ADR-0045 — Wizard reordenado para bater com RF-09 (M6)

O RF-09 especifica 5 passos: upload → mapa → **visual** → **interações** →
**revisão e publicação**. As milestones M2–M4 construíram as telas de upload,
mapa, interações e visual incrementalmente (cada uma focada no seu próprio
recorte), e a ordem de navegação acabou saindo mapa→interações→visual (com
publicar embutido no passo visual) — divergente do RF-09 e sem um passo 5
dedicado. Corrigido nesta milestone (que é onde "wizard 5 passos" está
formalmente no DoD): `visual` perdeu publish/versões/rollback (agora só
template+paleta+acesso, com "Salvar e continuar" para `interacoes`); um novo
`/projeto/:id/revisar` concentra resumo, prévia final, publicação e histórico
de versões. Todos os headers dos 4 passos existentes ganharam o rótulo de 5
passos consistente.

## ADR-0046 — Impersonação: token de curta duração + consumo em nova aba (M6)

`POST /admin/users/:id/impersonate` assina um access token com
`impersonatorId` e devolve o token cru (não grava cookie na resposta do admin).
O admin abre `{WEB_APP_URL}/impersonar?token=...` — uma página pública no app
do criador que troca o token por um cookie de acesso **somente-access** (sem
refresh, via `setAccessCookieOnly`) e redireciona para `/painel`. O app do
criador exibe um banner fixo ("Sessão de suporte — acesso iniciado por
{email}") sempre que `/auth/me` retornar `impersonatedBy`; exclusão de conta é
bloqueada nesse estado (`account.controller.ts`).

**Ressalva conhecida:** como admin e app do criador chamam a mesma origem de
API, o cookie de acesso é do MESMO cookie jar do navegador — abrir a
impersonação **substitui** a sessão do admin também em outras abas já abertas
daquele navegador (não há isolamento por aba, só por perfil/janela). A falha é
seguramente contida (o console admin nega acesso a um papel não-admin em vez de
agir silenciosamente como o criador), mas é uma UX ruim se não avisada — por
isso o botão "Impersonar" tem um aviso inline e o próprio `confirm()` menciona
"use uma janela anônima" antes de prosseguir. Uma solução completa (cookies com
nomes distintos por contexto admin/criador) foi considerada e descartada por
escopo: exigiria repensar como os guards escolhem qual cookie ler, e o Épico 6
não pede esse nível de isolamento.

## ADR-0047 — Build de `packages/db` trava no Windows com `nest start --watch`/`tsx watch` ativos

`prisma generate` (chamado por `db:build`, dependência de `^build` no
`turbo.json`) falha com `EPERM: operation not permitted, rename ...
query_engine-windows.dll.node.tmp...` sempre que a API (`nest start --watch`)
ou o worker (`tsx watch`) estão rodando — o Windows bloqueia o rename do
binário nativo do Prisma enquanto ele está mapeado em memória por um processo
vivo. Não reproduz em `typecheck`/`test` isolados (cache normalmente evita
regenerar), só quando algo invalida o cache global (ex.: editar `.env`, listado
em `globalDependencies` do `turbo.json`) e força um rebuild de `@eduforge/db`
com os processos de dev no ar. Mitigação: parar `api`/`worker` antes de rodar
`pnpm build`/`pnpm verify` depois de mexer em `.env`; religar depois. Não é um
bug de código — é uma característica do file locking do Windows.

## ADR-0048 — Determinismo do Pacote INPI: `archiver` + PDFs com data fixa (M7)

O ZIP canônico (RF-16.1) usa `archiver('zip', { zlib: { level: 9 } })` com
`date`/`mode` **fixos por entrada** (`1980-01-01T00:00:00Z`, `0o644`) em vez dos
padrões do SO — sem isso, o timestamp de cada arquivo no ZIP variaria a cada
geração e quebraria a reprodutibilidade do hash. Testado empiricamente: os PDFs
gerados por `pdf-lib` (memorial e declaração) TAMBÉM embutem `CreationDate`/
`ModificationDate` por padrão (`new Date()`) — corrigido chamando
`doc.setCreationDate(fixedDate)`/`setModificationDate(fixedDate)` com a data de
publicação da versão (não `new Date()`), o que já basta para bytes idênticos
(confirmado gerando o mesmo PDF 2× e comparando SHA-256). A função pura
`buildInpiPackage` (`apps/worker/src/inpi/domain/package-builder.ts`) recebe
todos os arquivos já prontos como `Buffer` — nenhuma chamada de I/O dentro
dela — o que permite testar a reprodutibilidade do DoD ("gerar 2×, comparar
hashes") como teste unitário rápido, sem depender de Playwright/S3 reais.

## ADR-0049 — `buildFichaRegistro`/`buildMetadata` vivem em `packages/schemas`

A Ficha de Registro (RF-16.3) precisa ser calculada em dois lugares: pelo
worker, ao montar `METADATA.json` dentro do ZIP; e pela API, para exibir os
mesmos campos na tela sem esperar uma nova geração de pacote. Como `apps/*` não
podem depender umas das outras (só de `packages/*`) e o PRD fixa "6 pacotes"
como decisão de arquitetura (não reabrir), essa lógica pura foi colocada em
`packages/schemas/src/inpi-metadata.ts` — mesmo padrão já usado por
`manifest.ts`/`canonicalize()` (utilitário puro compartilhado, sem back-end
próprio) — em vez de criar um sétimo pacote ou duplicar a lógica.

## ADR-0050 — Correção do modo escuro do runtime (bug real descoberto no M7)

Ao implementar as capturas de tela "claro/escuro" (RF-16.1), descobri que o
runtime **nunca de fato aplicava `theme.palette.dark`** — `App.tsx` sempre
renderizava `manifest.theme.palette.light`, ignorando a preferência do sistema
do visitante; a paleta escura só era usada como prévia manual no Estúdio
(`apps/web/.../visual`), não no app publicado. Isso afetava todo aprendiz real
com `prefers-color-scheme: dark`, não só a geração do pacote INPI — corrigido
com um hook `useSystemColorScheme()` (`apps/runtime/src/lib/color-scheme.ts`,
reativo via `matchMedia`) e uma função `activeTheme()` que escolhe
`palette.light`/`palette.dark` conforme o esquema detectado, aplicada em
`LearnerExperience`, `LearnerAuth` e `CertificateScreen`. Suíte E2E
(`pnpm test:e2e`) e os testes do runtime continuam verdes após a mudança.

## ADR-0051 — Captura de telas usa uma conta de aprendiz descartável

O runtime exige matrícula (`/learner/me` autenticado) para exibir qualquer
conteúdo, mesmo em apps de acesso público — não existe um modo "prévia anônima"
separado. Para capturar as telas reais do app (RF-16.1, não uma tela de
login), `apps/worker/src/inpi/screenshots.ts` cria, via `context.request` do
Playwright, uma conta de aprendiz efêmera (`inpi-preview+<uuid>@internal.
eduforge.local`, nome "EduForge — Prévia INPI (sistema)"), matricula-a no app
e só então navega + captura (mobile/desktop × claro/escuro, com
`page.emulateMedia({colorScheme})` — funcional graças à ADR-0050). A conta não
é exposta ao titular nem reaproveitada entre gerações; não há exclusão
automática (fora do escopo desta milestone), mas o nome deixa claro que é uma
conta de sistema caso apareça em uma consulta administrativa futura.

## ADR-0052 — Idempotency-Key: Redis SET NX + replay, só nas rotas novas

O PRD exige `Idempotency-Key` obrigatória em toda rota `POST` com efeito
colateral, citando `/publish` e `/inpi/*` como exemplos — mas `/publish` (M4)
já foi ao ar sem isso. Decisão: implementar `IdempotencyInterceptor`
(`apps/api/src/common/idempotency.interceptor.ts`, `SET key PENDING NX EX 24h`
→ processa e grava a resposta; corrida ou repetição dentro de 24h → replay da
resposta salva ou 409 se ainda em andamento) e aplicá-lo **somente** nas rotas
novas deste módulo (`POST .../inpi/package`, `POST .../inpi/certificates/:id/
verify`), sem retrofitar `/publish` — escopo deliberadamente contido ao que o
DoD do M7 pede; retrofit de `/publish` fica como débito técnico conhecido, não
escondido (citado aqui em vez de `TODO` no código porque é uma decisão de
escopo de milestone, não um requisito adiado por tipo).

## ADR-0053 — Verificação de integridade é log append-only, não mutação do certificado

`inpi_certificates` é uma das 4 tabelas WORM (ADR-0043: sem UPDATE/DELETE para
`eduforge_app`) — então "verificar integridade" não pode gravar um campo tipo
`last_verified_at` na própria linha. Nova tabela `inpi_certificate_
verifications` (append-only, mesmo tratamento de permissão que as WORM
originais) guarda cada verificação como uma linha nova (`matched`,
`recomputed_hash`, `verified_at`); a API expõe só a mais recente
(`lastVerification`) nas consultas, mas o histórico completo fica auditável.

## ADR-0054 — Máquina de estados do Registro Assistido: predicados puros, não uma tabela genérica

`InpiFilingStatus` tem 8 estados (`draft…granted/rejected/revoked`), mas em vez
de uma tabela de transições genérica, `apps/api/src/inpi-filing/domain/
state.ts` expõe uma função `canX(status): boolean` por ação (`canUploadPoa`,
`canProtocol`, `canGrant` etc.) — mesmo estilo já usado no resto do código
(`displayStatus()`, `hasPendingChanges()` do M6). Cada serviço chama o
predicado certo antes de agir e lança `Errors.conflict(...)` se falhar; a
regra "PJ deve assinar com e-CNPJ" vive em `validatePoaSignature()`, separada
das transições de status — testável isoladamente dos efeitos colaterais.

## ADR-0055 — `SignatureValidator`: detecção estrutural real de PAdES, cadeia de confiança mockada

Dividido em duas camadas, ambas no M8 DoD: (1) `scanForPadesMarkers()` é um
scan **real** dos bytes do PDF (regex por `/ByteRange` + `/SubFilter`
reconhecido — `ETSI.CAdES.detached`/`adbe.pkcs7.detached`), sem dependências
externas; rejeita de cara um PDF sem assinatura nenhuma. (2) A legitimidade da
cadeia de certificação (ICP-Brasil, OCSP/CRL, correspondência real
certificado↔CPF/CNPJ) exigiria infraestrutura de PKI inexistente neste
ambiente — fica atrás de `SignatureValidator`, cujo `MockSignatureValidator`
confia nos dados **declarados pelo usuário** desde que a camada (1) passe.
A regra de negócio "PJ não pode assinar com e-CPF do representante"
(`validatePoaSignature`, ADR-0054) é aplicada sobre o resultado de QUALQUER
implementação de `SignatureValidator` — continua correta no dia em que a
mockada for trocada por uma real.

## ADR-0056 — Upload de procuração/certificado via URL pré-assinada (reaproveita o padrão do M2)

Em vez de multipart (não configurado neste projeto) ou base64 no corpo JSON,
a procuração (criador) e o Certificado de Registro (operador) seguem o MESMO
padrão de duas etapas do upload de código-fonte do M2:
`POST .../poa/upload-url` devolve uma URL PUT pré-assinada para o bucket WORM;
o cliente envia os bytes direto ao MinIO; só então `POST .../poa/confirm`
(sem bytes no corpo) baixa o objeto de volta no servidor para rodar o
`SignatureValidator`. Evita limites de tamanho de corpo do Fastify/Nest e
mantém a API livre de lidar com bytes de arquivo em memória.

## ADR-0057 — Checklist do C.6: só 2 campos persistidos, o resto é derivado

O checklist operacional do wireframe C.6 tem 6 itens, mas só 2 não têm uma
fonte de verdade própria (**DV baixada e assinada**, **dupla conferência**) —
guardados em `inpi_filings.operator_checklist` (JSON). Os outros 4 (ZIP ok,
Ficha ok, Procuração, GRU paga) são computados a cada leitura a partir de
campos que já existem (`inpiCertificateId` não-nulo, `poaPdfS3Key`,
`feeCentsGru`) — evita duplicar estado que já é a fonte da verdade em outro
lugar e ficar dessincronizado dele.

## ADR-0058 — Um pedido ativo por certificação; auditoria reaproveitada do M6

`FilingService.contract()` rejeita um segundo pedido `assisted` para a MESMA
certificação RF-16 enquanto o primeiro não for revogado/rejeitado (mesmo
padrão de guarda contra duplicidade do M7 para certificações). Toda ação do
operador (`OperatorService`) grava em `audit_logs` via a `AuditService` do
`AdminModule` — agora exportado (antes só `FeatureFlagsService` saía do
módulo) — em vez de duplicar a infraestrutura de auditoria append-only já
construída no M6; satisfaz literalmente o "Toda ação é registrada em
auditoria imutável" do wireframe C.6.

## ADR-0059 — API key como segundo APP_GUARD; escopos com wildcard por namespace (M9)

A autenticação da API pública (B.1) entra como um SEGUNDO `APP_GUARD`
(`ApiKeyAuthGuard`) depois do `JwtAuthGuard` de sessão: se a sessão já
populou `req.user`, o guard só valida escopo; senão tenta `Authorization:
Bearer efk_live_…/efk_test_…` (hash SHA-256+pepper, mesma `hashToken` do
M1). Assim as MESMAS rotas servem painel (cookie) e integração (chave) sem
duplicar controllers. Escopos seguem a tabela B.2 com `content:*`/
`learners:*` como wildcard por namespace (`hasScope`); rate limit de 120
req/min é janela fixa por chave no Redis (`INCR`+`PEXPIRE`), headers
`X-RateLimit-*` e `429` com `Retry-After` — janela deslizante fica para
quando houver necessidade real.

## ADR-0060 — Cifra reversível compartilhada em `packages/schemas` (M9)

`encryptSecret`/`decryptSecret` (AES-256-GCM) saíram de
`apps/api/src/auth/domain/crypto.ts` para `packages/schemas/src/crypto.ts`:
o segredo de assinatura de webhook é cifrado pela api na criação do
endpoint e DECIFRADO PELO WORKER na hora de assinar a entrega — e apps não
podem depender de apps (mesma razão do ADR-0049). O módulo da api
re-exporta para não tocar os call sites do TOTP; `generateToken`/
`hashToken`/`safeEqualHex` continuam na api (só ela precisa).

## ADR-0061 — Entrega de webhooks: fila dedicada, ~24h de retry, tudo registrado (M9)

Entregas rodam na fila `webhook-delivery` com backoff exponencial custom
(base 1 min, cap 4h): 13 tentativas somam ~24h15 — a leitura prática do
"retry exponencial por 24h" do B.4. Cada tentativa (sucesso, falha de rede
ou HTTP não-2xx) atualiza `webhook_deliveries` ANTES de relançar para o
BullMQ, então o painel sempre mostra o estado real. Endpoint removido ou
desativado marca a entrega como `exhausted` sem retry (reter para sempre
não notificaria ninguém). Corpo de resposta é truncado (2 KB) para não
inflar a tabela. A assinatura `t=<ts>,v1=<hmac_sha256>` e a verificação
com tolerância de 5 min vivem em `packages/schemas` (api e worker usam).

## ADR-0062 — Disparo dos eventos é best-effort; worker tem espelho próprio (M9)

`WebhooksService.dispatch`/`dispatchForProject` nunca lançam: falha ao
notificar não pode reverter a ação de negócio que originou o evento
(publicação, matrícula, protocolo…). No lado da api os serviços recebem o
`WebhooksService` injetado (module import, mesmo padrão do `AuditService`
no M8). No worker, os eventos de pipeline (`ingest.completed/failed`,
`interactions.generated`, `inpi.package.ready`, `credits.low_balance`)
disparam no WRAPPER dos jobs em `index.ts` — as pipelines puras não sabem
que webhooks existem — via `BullMqWebhookNotifier`, espelho da mesma
consulta de fan-out. `credits.low_balance` só dispara quando o débito CRUZA
o limiar (`crossedLowBalanceThreshold`), não a cada geração com saldo baixo;
limiar por usuário fica para quando existir a configuração (constante
`AI_CREDITS.lowBalanceThreshold`).

## ADR-0063 — OpenAPI 3.1 derivado dos Zod DTOs, sem @nestjs/swagger (M9)

`GET /v1/openapi.json` (rota `@Public()`) serve um documento OpenAPI 3.1
montado por `buildOpenApiDocument()` a partir de um registro DECLARATIVO
(`openapi/registry.ts`) cujos request bodies são os MESMOS Zod DTOs que
validam as bordas, convertidos com `zod-to-json-schema` ($refStrategy
none, `$schema` removido — 3.1 aceita JSON Schema puro). Retrofitar
`@nestjs/swagger` com decorators em 8+ módulos duplicaria a fonte da
verdade que o PRD fixa no Zod. Limitações aceitas: respostas documentadas
como objeto genérico + Problem Details (as respostas não têm Zod hoje), e
a árvore recursiva do Mapa de Conteúdo degrada para `any` no nível mais
interno. Escopo B.2 vai como extensão `x-required-scope`.

## ADR-0064 — Coleção Supertest B.3 contra a API real, fora do verify (M9)

`apps/api/test/b3-flow.e2e.ts` (config própria `vitest.e2e.config.ts`,
script `pnpm test:api`) roda o fluxo B.3 ponta a ponta AUTENTICADO POR API
KEY contra a api real em :3333 — upload via URL pré-assinada (MinIO real),
ingestão consumida pelo worker real, geração, tema do catálogo e publish
com Idempotency-Key (+ replay idêntico, 400 sem a chave, 401/403/400 do
B.5). Fica fora do `pnpm verify` pela mesma razão do Playwright E2E:
exige api+worker+docker no ar. A fonte de teste é um `.md` (extração real,
sem depender de parsing de PDF binário no teste).

## ADR-0065 — Embedder lexical mock 1536 dims para o RAG do Sensei (M10)

O `MockAiProvider.embedTexts` usa bag-of-features (palavra + trigramas)
hasheada por FNV-1a em 1536 dimensões, L2-normalizada. A similaridade de
cosseno entre vetores reflete sobreposição de vocabulário real — o RAG
funciona de verdade sem API externa. O limiar de similaridade
(`SIMILARITY_THRESHOLD`) calibrado em 0.12 na avaliação de 20 perguntas
(etapa 39) separa perguntas in-scope de out-of-scope com o mock embedder,
mas o vocabulário de função do português (artigos, preposições) cria falsa
sobreposição; a avaliação usa perguntas out-of-scope multilíngues
(polonês, francês, russo, alemão) para garantir disjunção lexical. Com um
embedder real (API Anthropic), o limiar pode ser recalibrado; o valor
final deve ser documentado aqui. `EMBEDDING_DIM=1536` em provider.ts.

## ADR-0066 — Portão estrutural de citação (não confia no provider)

O DoD do M10 ("Sensei nunca responde sem citação") é implementado como
um portão ESTRUTURAL em `enforceCitationGate` (`apps/api/src/sensei/domain/guardrails.ts`):
toda resposta do `AiProvider.tutorAnswer` passa por uma verificação que
descarta citações cujo `blockId` não pertence ao contexto recuperado, e
uma resposta que fique sem NENHUMA citação válida vira recusa com
mensagem apropriada ao tom do tutor. O portão vale para QUALQUER
implementação de `AiProvider` (mock ou LLM real) — a segurança não
depende do modelo. O provider ainda pode recusar por conta própria
(`refused: true`), caso em que o portão apenas propaga a recusa.

## ADR-0067 — Conquistas e ranking computados na leitura, sem tabela nova

As 8 conquistas do RF-06.7 (primeiro-passo, em-ritmo, semana-de-fogo,
centurião, sábio, meio-caminho, conclusão, certificado) são computadas
na leitura a partir do estado existente (`enrollments.xp`,
`enrollments.streak_days`, `learning_progress`, `certificates`) — sem
tabela dedicada de achievements. `computeAchievements` em
`apps/api/src/learning/domain/achievements.ts` é uma função pura que
recebe `AchievementStats` e retorna `Achievement[]` com flag `unlocked`.
O ranking (`GET /public/apps/:slug/leaderboard`) é um top 10 por XP
com nome abreviado ("Marina S."), sem janela temporal no MVP.

## ADR-0068 — Mídia pós-publicação fora do manifesto imutável

Podcasts e ilustrações (RF-06.5, M10 "imagens IA") são armazenados em
`media_assets` (tabela já existente desde o M0) e servidos por rotas
públicas separadas (`GET /public/apps/:slug/media`), NÃO entram no
`manifest.json` do app publicado. O manifesto é imutável e seu hash
SHA-512 não pode mudar após a publicação (RF-04/RF-16). A mídia é
gerada sob demanda pós-publicação e versionada no S3 por
`projectId/chapterId`; regerar substitui (upsert). O runtime busca a
lista de mídia separadamente do manifesto.

## ADR-0069 — Escopo do M10: RF-06.2/3/4/6/8 diferidos para Fase 3

O M10 implementa: RF-06.1 (Sensei/RAG com citação), RF-06.5 (podcast/TTS),
RF-06.7 (gamificação: conquistas + ranking + efeitos visuais), e imagens
IA (do RF-03). Ficam DIFERIDOS para a Fase 3 (meses 9-12 do roadmap,
PRD linha 985-996): RF-06.2 (DNA de Aprendizagem), RF-06.3 (Modo História),
RF-06.4 (Batalha de Quiz em tempo real), RF-06.6 (Modo Foco Neuro-adaptativo),
RF-06.8 (Time Capsule). O RF-06.6 não aparece em nenhuma tabela de custo
do PRD; fica como candidato a descarte ou Fase 3 tardia.
