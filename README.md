# EduForge

> De um PDF a um aplicativo de aprendizagem publicado em menos de 30 minutos, sem escrever código.

Plataforma SaaS que ingere ebooks/apostilas (PDF, EPUB, DOCX, Markdown) e, por meio de um
pipeline de IA, gera aplicativos web (PWA) de aprendizagem interativa: módulos navegáveis,
quizzes, flashcards, simulações, gamificação e trilhas adaptativas.

Este repositório é um **monorepo** (pnpm + Turborepo). A fonte da verdade do produto é o
[`PRD.md`](./PRD.md); o estado de implementação e as convenções vivem em [`CLAUDE.md`](./CLAUDE.md).

## Pré-requisitos

- Node.js **>= 20** (testado com 24)
- pnpm **9** (`npm i -g pnpm@9.15.0`)
- Docker + Docker Compose (Postgres, Redis, MinIO)

## Primeiros passos

```bash
pnpm install            # instala todas as dependências do workspace
cp .env.example .env    # ajuste se necessário
pnpm docker:up          # sobe Postgres (pgvector), Redis e MinIO
pnpm db:reset           # aplica o schema do zero e roda os seeds
pnpm dev                # sobe web + admin + api + worker + runtime
```

## Serviços em desenvolvimento

| App             | Porta | URL                     |
| --------------- | ----- | ----------------------- |
| web (criador)   | 3000  | http://localhost:3000   |
| admin (console) | 3001  | http://localhost:3001   |
| api (REST /v1)  | 3333  | http://localhost:3333   |
| worker (health) | 3334  | http://localhost:3334   |
| runtime (PWA)   | 5173  | http://localhost:5173   |
| MinIO console   | 9001  | http://localhost:9001   |

Healthchecks: `GET http://localhost:3333/health` (api) e `GET http://localhost:3334/health` (worker).

## Scripts principais

| Comando           | Descrição                                        |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | Sobe todos os apps em modo desenvolvimento       |
| `pnpm verify`     | `lint` + `typecheck` + `test` (CI local)         |
| `pnpm build`      | Build de produção de todos os pacotes/apps       |
| `pnpm db:reset`   | Recria o banco do zero e roda os seeds           |
| `pnpm db:seed`    | Executa apenas os seeds                          |
| `pnpm db:studio`  | Abre o Prisma Studio                             |
| `pnpm docker:up`  | Sobe a infraestrutura local (Docker)             |

## Estrutura

```
apps/       web, admin, api, worker, runtime
packages/   config, db, schemas, ai, ui, testing
docs/       DECISIONS.md (ADRs)
```

Consulte a **Parte 0** do `PRD.md` para as instruções completas de desenvolvimento.
