# ⚙️ Manual Técnico de Engenharia & Arquitetura — EduForge

Este documento destina-se a engenheiros de software, arquitetos de soluções, DevOps e mantenedores do **EduForge**, detalhando a infraestrutura, os padrões de código e a operação da plataforma em desenvolvimento e produção.

---

## 🏛️ 1. Visão Geral da Arquitetura

O EduForge é estruturado como um monorepo TypeScript modular sob **pnpm workspaces** e **Turborepo**, orientado a arquitetura hexagonal (Ports & Adapters) na camada de domínio da API e jobs assíncronos desacoplados por filas.

```
                                  ┌───────────────────────────────┐
                                  │      Cloudflare Edge CDN      │
                                  └───────────────┬───────────────┘
                                                  │
                ┌─────────────────────────────────┼─────────────────────────────────┐
                ▼                                 ▼                                 ▼
      ┌──────────────────┐              ┌──────────────────┐              ┌──────────────────┐
      │  apps/web (:3000)│              │ apps/admin(:3001)│              │apps/runtime(:5173│
      │  Next.js 14 SSR  │              │  Next.js 14 SSR  │              │ NGINX Static PWA │
      └─────────┬────────┘              └─────────┬────────┘              └─────────┬────────┘
                │                                 │                                 │
                └─────────────────────────────────┼─────────────────────────────────┘
                                                  ▼
                                      ┌───────────────────────┐
                                      │   apps/api (:3333)    │
                                      │ NestJS 10 + Fastify   │
                                      └───────────┬───────────┘
                                                  │
                     ┌────────────────────────────┼────────────────────────────┐
                     ▼                            ▼                            ▼
          ┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
          │   Neon PostgreSQL    │     │    Upstash Redis     │     │   Cloudflare R2 S3   │
          │ Serverless + pgvector│     │ BullMQ + Cache + Rate│     │ WORM & Asset Storage │
          └──────────────────────┘     └──────────┬───────────┘     └──────────────────────┘
                                                  │
                                                  ▼
                                      ┌───────────────────────┐
                                      │  apps/worker (:3334)  │
                                      │ BullMQ Background Jobs│
                                      └───────────────────────┘
```

---

## 📦 2. Estrutura de Aplicações e Pacotes

```
apps/
  ├─ api/       (NestJS 10 REST API sobre Fastify 4, portas 3333 /v1)
  ├─ worker/    (BullMQ background processor: ingestão, geração IA, INPI, TTS, webhooks)
  ├─ admin/     (Console Administrativo em Next.js 14 Standalone, porta 3001)
  ├─ web/       (Portal do Criador em Next.js 14 Standalone, porta 3000)
  └─ runtime/   (PWA de aprendizagem em Vite 5 + React 18, servido por NGINX, porta 5173)

packages/
  ├─ db/        (Prisma 5 ORM, migrations SQL dinâmicas, seeds e client singleton)
  ├─ schemas/   (Validações Zod para os 9 tipos de interações, crypto AES/HMAC e regras)
  ├─ ai/        (Provedores de IA: Anthropic Claude, OpenAI GPT-4o, DeepSeek e MultiProvider)
  ├─ ui/        (Tokens de design, temas, variáveis CSS e verificador de contraste WCAG AA)
  ├─ config/    (Validação de variáveis de ambiente com Zod e tipagem estrita)
  └─ testing/   (Factories, fixtures e geradores de carga para testes automatizados)
```

---

## ☁️ 3. Integrações de Nuvem em Produção

### 🐘 Banco de Dados: Neon PostgreSQL Serverless
- Conexão principal via pooling (`DATABASE_URL`) com SSL obrigatório (`sslmode=require`).
- Conexão direta sem pooler (`DIRECT_DATABASE_URL`) para migrações DDL do Prisma.
- Extensão `pgvector` habilitada para indexação vetorial e buscas semânticas do tutor Sensei (dimensão 1536d).
- Imutabilidade a nível de banco de dados (`eduforge_app` role) para tabelas críticas (`audit_logs`, `app_versions`, `ai_credit_ledger`, `inpi_certificates`).

### ⚡ Mensageria e Cache: Upstash Redis
- Conexão segura via TLS (`rediss://...`) com timeout de conexão calibrado e failover.
- Gerenciamento de 9 filas no BullMQ:
  1. `ingest`: Extração e leitura de documentos (PDF, DOCX, Markdown).
  2. `generate`: Geração de atividades e interações com IA.
  3. `tts`: Roteirização e síntese de áudio de podcasts.
  4. `inpi-package`: Montagem do pacote determinístico e captura de telas via Playwright.
  5. `sensei-embed`: Geração de embeddings e indexação semântica.
  6. `webhook-delivery`: Entrega resiliente de webhooks com backoff exponencial.
  7. `system`: Limpeza periódica e jobs de manutenção.
  8. `account-anonymize`: Anonimização e exclusão LGPD assíncrona.
  9. `time-capsule`: Agendamento de revisões espaçadas.

### 🗄️ Armazenamento de Objetos: Cloudflare R2
- Compatível com a API AWS S3 SDK v3, operando com **zero taxa de tráfego de saída (Zero Egress)**.
- Geração de URLs pré-assinadas (`presigned URLs`) para upload e download direto de arquivos grandes.
- Bucket WORM dedicado (`S3_BUCKET_WORM`) para preservação imutável de pacotes e declarações do INPI.

### 🤖 Multi-Provider de Inteligência Artificial
- Orquestrador `MultiProvider` que chaveia automaticamente entre múltiplos modelos:
  - **Anthropic Claude 3.5 Sonnet:** Modelagem complexa, mapas de conteúdo e geração pedagógica.
  - **OpenAI GPT-4o:** Avaliação por rubrica e estruturação de texto.
  - **DeepSeek V3 / Chat:** Alta velocidade e baixo custo para tarefas de alta densidade.
- Circuit breaker com medição de latência em milissegundos e timeout de 25s por chamada.

---

## 🔒 4. Segurança e Performance

- **Fastify Compress:** Compressão automática Gzip e Deflate de respostas HTTP para redução de banda de até 70%.
- **Fastify Helmet:** Headers de segurança HTTP (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 0`).
- **Autenticação Hexagonal:** Sessões com JWT rotativo, suporte a TOTP MFA com encriptação AES-256 de segredos (`AUTH_ENCRYPTION_KEY`) e bloqueio progressivo anti-força bruta.
- **PWA Offline Resilience:** Workbox Service Worker configurado com `CacheFirst` para fontes e `NetworkFirst` (com cache de até 7 dias) para manifestos de aplicativos.
- **Error Boundaries:** Componentes `error.tsx` e `global-error.tsx` em `apps/web` e `apps/admin` com opções de recuperação instantânea e limpeza de cache.

---

## 🛠️ 5. Comandos de Operação e Manutenção

| Comando | Finalidade |
| :--- | :--- |
| `pnpm install` | Instala todas as dependências do monorepo |
| `pnpm verify` | Executa linter, typecheck e todos os 257 testes em paralelo |
| `pnpm build` | Compila todos os pacotes e aplicações |
| `pnpm db:migrate` | Aplica migrações pendentes no banco PostgreSQL |
| `pnpm db:seed` | Executa o seed inicial de planos, templates, paletas e app demo |
| `pnpm test:api` | Executa a suíte de testes de integração Supertest contra a API REST |
| `docker compose -f docker-compose.prod.yml up -d --build` | Compila e inicia os 5 containers de produção |

---

## 🚀 6. Pipeline de CI/CD e Deploy em Produção

O repositório conta com pipelines automatizados no GitHub Actions:

- `.github/workflows/ci.yml`: Validação automática de Lint, TypeScript estrito e 257 testes automatizados a cada Pull Request ou commit na `main`.
- `.github/workflows/deploy.yml`: Compilação das imagens Docker multi-stage com OpenSSL e healthchecks nativos do Node.js.

### Deploy Manual em VPS / Servidor Remoto
```bash
git clone https://github.com/nacife/gerarapp.git
cd gerarapp
# Crie o arquivo .env com as credenciais de produção
docker compose -f docker-compose.prod.yml up -d --build
```
