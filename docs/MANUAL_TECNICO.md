# Manual Técnico - EduForge

Este documento destina-se a engenheiros de software, mantenedores e arquitetos do **EduForge**, detalhando a infraestrutura e a arquitetura das aplicações que operam a plataforma.

O EduForge é um monorepo TypeScript gerenciado com `pnpm workspaces` e `Turborepo`, focado em transformar documentos em aplicativos de aprendizagem progressivos (PWAs) utilizando inteligência artificial.

---

## 1. Arquitetura e Stack (Milestone 14)

A stack tecnológica do EduForge foi desenhada para altíssima resiliência e validação estrita nas bordas.

- **Linguagem Principal:** TypeScript (Estrito)
- **Painéis (Admin e Criador):** Next.js 14 (App Router)
- **API Backend:** NestJS 10 + Fastify
- **Processamento em Background (Jobs):** BullMQ + Redis
- **Banco de Dados:** PostgreSQL 16 (com `pgvector` para Busca Semântica/RAG) + Prisma ORM
- **Runtime PWA:** Vite 5 + React 18
- **Validação de Dados:** Zod (usado extensivamente na borda, com `ZodValidationPipe`)
- **Arquivos e Objetos:** S3 compatível (MinIO local)

---

## 2. Estrutura do Monorepo

O projeto está dividido entre `apps/` (aplicações executáveis) e `packages/` (bibliotecas compartilhadas internas).

```
apps/
  ├─ api/       (NestJS REST API, porta: 3333, base em hexagonal e adapters)
  ├─ worker/    (Processamento via BullMQ, porta: 3334. Ingestão, AI, INPI, Webhooks)
  ├─ admin/     (Next.js Admin Console, porta: 3001)
  ├─ web/       (Next.js Painel do Criador, porta: 3000)
  └─ runtime/   (Vite PWA, roda no navegador servindo os templates publicados)

packages/
  ├─ db/        (Prisma Schema, Client Singleton, Seeds e Migrations)
  ├─ schemas/   (Validações Zod essenciais das interações, cryptos e regras de negócio)
  ├─ ai/        (Provedores de IA - Mock e Anthropic)
  ├─ ui/        (Tokens de Design e Paletas baseados no WCAG)
  ├─ config/    (RootEnv, constantes de Roles)
  └─ testing/   (Fakes, Factories e Fixtures para TDD e Testes de Integração)
```

---

## 3. Configuração Local e Setup

Para configurar a infraestrutura de desenvolvimento na máquina local:

1. **Dependências Node:** `pnpm install`
2. **Infraestrutura Docker:** (Garante o Postgres, Redis e MinIO no ar)
   - Iniciar: `pnpm docker:up`
   - Resetar Volumes: `pnpm docker:reset`
3. **Banco de Dados:**
   - Popular banco do zero: `pnpm db:reset`
   - Migrar (em caso de alterações no schema): `pnpm db:migrate`
4. **Execução Local:**
   - Rodar todas as aplicações de uma vez via Turbo: `pnpm dev`
5. **Integração Contínua (Local):**
   - Garantir linting, types e testes: `pnpm verify`

*(Certifique-se de que o Docker Desktop esteja rodando antes de executar comandos `docker:up` ou `db:reset`).*

---

## 4. Subsistemas Críticos

### Identidade e RBAC (Role-Based Access Control)
- Arquitetura Hexagonal com *Domínio Puro* (`AuthUser`, `SessionRecord`).
- **Autenticação:** Baseada em cookies http-only e JWT. Suporta login, recuperação de senha, e bloqueio de tentativas brutas (Lockout).
- **MFA (TOTP):** Implementação nativa (`otplib`), garantindo segurança robusta em áreas administrativas.
- **Impersonação:** Permite que um administrador gere um token e acesse a UI Web como se fosse um usuário específico para debug e suporte.

### Criação e Pipeline de IA
- **Ingestão (`worker/ingest`):** Consome arquivos via URL pré-assinada do MinIO. Converte PDF, DOCX, EPUB ou MD em blocos lógicos usando processadores semânticos (ex: unpdf).
- **Interações (`worker/generate`):** A geração baseia-se num prompt estrito valendo-se do `packages/schemas`. O resultado é validado via Zod; se inválido, entra em loop de retry (2x) antes de falhar de vez. Toda geração cobra do `ai_credit_ledger`.
- **Sensei (RAG):** Vetores injetados no PostgreSQL via `pgvector`. A IA (Sensei) usa RAG em cima do conhecimento isolado de um único `Manifest`.

### Sistema de Proteção e INPI
O módulo mais sensível juridicamente. Garante empacotamento **Determinístico**.
- Arquivos de código, Playwright Headless para print das telas (mobile/desktop), Memorial Descritivo gerado por IA.
- Assinatura: SHA-512 canônico + zip armazenado num bucket S3 do tipo WORM (Write-Once-Read-Many).
- Assinatura PAdES: PDFs assinados com e-CNPJ são verificados nativamente (`scanForPadesMarkers`).

### Webhooks e API (Extensibilidade)
- As integrações externas usam Chaves de API encriptadas por Pepper + Hash.
- Toda requisição sensível obriga a passagem de `Idempotency-Key` processada com lock distribuído em Redis (evitando double-spend e double-publish).
- Webhooks são disparados do `worker` e entregues via fila `webhook-delivery` usando assinatura criptográfica local **HMAC-SHA256**.

---

## 5. Diretrizes para Contribuição

1. **Imutabilidade Auditável:** Modificações nas tabelas `audit_logs`, `inpi_certificates` e `ai_credit_ledger` são proibidas via `UPDATE`/`DELETE` em banco, graças à role endurecida `eduforge_app` nas permissões do PostgreSQL.
2. **Type Safety na Borda:** Nunca ignore o Zod. Qualquer I/O precisa ter schema explícito definido em `packages/schemas` se for trafegado entre os serviços.
3. **Problem Details:** Erros RESTful seguem obrigatoriamente a [RFC 9457 (Problem Details)](https://datatracker.ietf.org/doc/html/rfc9457).
4. **Sem Placeholders:** Caso haja dependências externas não prontas, deve-se usar os Providers falsos injetados e documentar no ticket. 

Dúvidas de mapeamento de código ou diagramas? Verifique o arquivo detalhado de decisões base em `docs/DECISIONS.md`.
