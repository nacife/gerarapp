# Guia de Operações e Go-Live em Produção — EduForge

Este documento consolida o **manual operacional de infraestrutura e procedimentos de lançamento (Go-Live)** da plataforma EduForge.

---

## 1. Arquitetura de Produção

O EduForge opera em topologia de microsserviços monorepo containerizada:

| Serviço | Tecnologia | Porta Interna | Porta Externa (Padrão) | Função |
| :--- | :--- | :--- | :--- | :--- |
| **`api`** | NestJS 10 + Fastify (Node 20) | `3333` | `3333` | REST API `/v1`, WebSocket de batalha, webhooks, auth JWT/MFA |
| **`worker`** | BullMQ + Redis + Playwright (Node 20) | `3334` | `3334` | Ingestão de arquivos, IA, TTS, geração INPI com screenshots |
| **`web`** | Next.js 14 Standalone (Node 20) | `3000` | `3000` | Painel do Criador (Studio, Mapa, Analytics) |
| **`admin`** | Next.js 14 Standalone (Node 20) | `3001` | `3001` | Console Administrativo (Usuários, Flags, Filas, Manuais) |
| **`runtime`** | NGINX Alpine (PWA Estático SPA) | `80` | `5173` ou `80` | App de aprendizagem publicado para o aluno |

---

## 2. Checklist Pré-Voo (Pre-Flight Checklist)

Antes de abrir a aplicação para usuários reais, execute as seguintes checagens:

- [ ] **Banco de Dados (PostgreSQL 16 + pgvector):**
  - Instância gerenciada provisionada (Supabase, Neon, AWS RDS ou VPS dedicada).
  - Extensão `vector` ativada: `CREATE EXTENSION IF NOT EXISTS vector;`
  - Permissões de role restrita aplicadas (ADR-0043: role `eduforge_app` não pode apagar registros de `audit_logs` ou `inpi_certificates`).
- [ ] **Redis (Filas e Sessões):**
  - Redis 7 com persistência `appendonly yes` e senha forte configurada (`requirepass`).
- [ ] **Armazenamento Cloudflare R2:**
  - 3 buckets criados: `eduforge-uploads`, `eduforge-apps`, `eduforge-worm`.
  - Bucket `eduforge-worm` com Object Lock / Retention policy habilitada.
  - Credenciais geradas em *R2 > Manage R2 API Tokens* com permissão de Admin/Read/Write.
- [ ] **Inteligência Artificial (LLMs):**
  - Chaves de API configuradas: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` ou `DEEPSEEK_API_KEY`.
  - `AI_PROVIDER` definido como `multi` para redundância ou `anthropic`/`openai`/`deepseek`.
- [ ] **E-mail Transacional (SMTP):**
  - `MAILER=smtp` configurado com credenciais de produção (Resend, SendGrid, Amazon SES ou Google Workspace).
- [ ] **Segredos Criptográficos:**
  - `JWT_SECRET`, `REFRESH_TOKEN_PEPPER` e `AUTH_ENCRYPTION_KEY` gerados com pelo menos 32 caracteres aleatórios e seguros (`openssl rand -hex 32`).

---

## 3. Procedimento de Deploy Passo a Passo

### 3.1. Clonar e Configurar Variáveis
```bash
git clone https://github.com/nacife/gerarapp.git /opt/eduforge
cd /opt/eduforge
cp .env.example .env
# Edite o .env com os segredos de produção
nano .env
```

### 3.2. Executar Migrações do Banco de Dados
Antes de iniciar os novos containers, aplique as migrações Prisma:
```bash
pnpm install --frozen-lockfile
pnpm db:deploy
```
*(Ou, se estiver rodando via container de migração: `docker compose -f docker-compose.prod.yml run --rm api pnpm db:deploy`)*

### 3.3. Build e Inicialização dos Containers
```bash
# Build e inicialização em background
docker compose -f docker-compose.prod.yml up -d --build

# Verificar logs e status de saúde
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api worker
```

---

## 4. Monitoramento e Healthchecks

### Endpoints de Saúde:
- **API Liveness:** `GET http://localhost:3333/health`
  ```json
  { "status": "ok", "service": "api", "uptime": 3600 }
  ```
- **API Readiness (checa conexão com Postgres):** `GET http://localhost:3333/health/ready`
  ```json
  { "status": "ok", "checks": { "db": { "status": "ok", "latencyMs": 2 } } }
  ```
- **Worker Liveness & Redis Health:** `GET http://localhost:3334/health`
  ```json
  { "status": "ok", "service": "worker", "uptime": 3600 }
  ```

---

## 5. Rotinas de Backup e Manutenção

1. **Backup Diário do Banco de Dados (PostgreSQL):**
   ```bash
   pg_dump -h <HOST> -U eduforge -d eduforge -F c -b -v -f "/backups/eduforge_$(date +%Y%m%d_%H%M%S).dump"
   ```
2. **Backup do Redis (RDB/AOF):**
   Garantir cópia periódica do arquivo `dump.rdb` ou `appendonly.aof` do volume `redis_data`.
3. **Limpeza de Logs e Jobs Concluídos:**
   O BullMQ realiza limpeza automática de jobs completados com base no retention configurado. O Painel Admin (`/filas`) permite reprocessar ou purgar jobs falhos com 1 clique.
