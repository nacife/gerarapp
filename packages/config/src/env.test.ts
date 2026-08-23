import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const validEnv: Record<string, string> = {
  DATABASE_URL: 'postgresql://eduforge:eduforge@localhost:5432/eduforge',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'eduforge',
  S3_SECRET_KEY: 'eduforge123',
  S3_BUCKET_UPLOADS: 'eduforge-uploads',
  S3_BUCKET_APPS: 'eduforge-apps',
  S3_BUCKET_WORM: 'eduforge-worm',
  JWT_SECRET: 'a'.repeat(32),
  REFRESH_TOKEN_PEPPER: 'b'.repeat(16),
  AUTH_ENCRYPTION_KEY: 'c'.repeat(32),
  APP_BASE_URL: 'http://localhost:3000',
  ADMIN_BASE_URL: 'http://localhost:3001',
  RUNTIME_BASE_URL: 'http://localhost:5173',
};

describe('loadEnv', () => {
  it('valida um ambiente correto e aplica defaults', () => {
    const env = loadEnv(validEnv);
    expect(env.NODE_ENV).toBe('development');
    expect(env.AI_PROVIDER).toBe('mock');
    expect(env.S3_REGION).toBe('auto');
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.S3_PUBLIC_URL).toBeUndefined();
    expect(env.API_PORT).toBe(3333);
    expect(env.WORKER_PORT).toBe(3334);
    expect(env.INPI_GRU_FEE_CENTS).toBe(21000);
  });

  it('aceita configurações específicas do Cloudflare R2', () => {
    const env = loadEnv({
      ...validEnv,
      S3_ENDPOINT: 'https://0123456789abcdef.r2.cloudflarestorage.com',
      S3_REGION: 'auto',
      S3_FORCE_PATH_STYLE: 'false',
      S3_PUBLIC_URL: 'https://cdn.eduforge.app',
    });
    expect(env.S3_ENDPOINT).toBe('https://0123456789abcdef.r2.cloudflarestorage.com');
    expect(env.S3_REGION).toBe('auto');
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
    expect(env.S3_PUBLIC_URL).toBe('https://cdn.eduforge.app');
  });

  it('faz coerção de portas numéricas a partir de strings', () => {
    const env = loadEnv({ ...validEnv, API_PORT: '4000' });
    expect(env.API_PORT).toBe(4000);
    expect(typeof env.API_PORT).toBe('number');
  });

  it('rejeita JWT_SECRET curto', () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: 'curto' })).toThrowError(/JWT_SECRET/);
  });

  it('exige ANTHROPIC_API_KEY quando AI_PROVIDER=anthropic', () => {
    expect(() => loadEnv({ ...validEnv, AI_PROVIDER: 'anthropic' })).toThrowError(
      /ANTHROPIC_API_KEY/,
    );
    expect(() =>
      loadEnv({ ...validEnv, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test' }),
    ).not.toThrow();
  });

  it('exige OPENAI_API_KEY quando AI_PROVIDER=openai', () => {
    expect(() => loadEnv({ ...validEnv, AI_PROVIDER: 'openai' })).toThrowError(
      /OPENAI_API_KEY/,
    );
    expect(() =>
      loadEnv({ ...validEnv, AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-openai-test' }),
    ).not.toThrow();
  });

  it('exige DEEPSEEK_API_KEY quando AI_PROVIDER=deepseek', () => {
    expect(() => loadEnv({ ...validEnv, AI_PROVIDER: 'deepseek' })).toThrowError(
      /DEEPSEEK_API_KEY/,
    );
    expect(() =>
      loadEnv({ ...validEnv, AI_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-deepseek-test' }),
    ).not.toThrow();
  });

  it('exige SMTP_URL quando MAILER=smtp', () => {
    expect(() => loadEnv({ ...validEnv, MAILER: 'smtp' })).toThrowError(/SMTP_URL/);
  });

  it('rejeita URL de banco inválida', () => {
    expect(() => loadEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow();
  });
});
