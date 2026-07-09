-- Imutabilidade por permissão de banco (PRD §0.5.2 / M6 DoD): cria uma role de
-- runtime restrita ("eduforge_app") e revoga UPDATE/DELETE nas tabelas que o
-- código nunca deve alterar/apagar (audit_logs, app_versions, ai_credit_ledger,
-- inpi_certificates). A role dona das tabelas (usada só por `prisma migrate`
-- via DIRECT_DATABASE_URL) sempre ignora GRANT/REVOKE — por isso a separação.

DO
$$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eduforge_app') THEN
    CREATE ROLE eduforge_app LOGIN PASSWORD 'eduforge_app';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE eduforge TO eduforge_app;
GRANT USAGE ON SCHEMA public TO eduforge_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eduforge_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eduforge_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eduforge_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO eduforge_app;

-- Append-only / WORM por design — sem UPDATE/DELETE mesmo para o código da aplicação.
REVOKE UPDATE, DELETE ON audit_logs FROM eduforge_app;
REVOKE UPDATE, DELETE ON app_versions FROM eduforge_app;
REVOKE UPDATE, DELETE ON ai_credit_ledger FROM eduforge_app;
REVOKE UPDATE, DELETE ON inpi_certificates FROM eduforge_app;
