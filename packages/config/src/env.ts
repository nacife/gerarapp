import { z } from 'zod';

/**
 * Schema de todas as variáveis de ambiente do MVP (PRD §0.7).
 * A aplicação NÃO sobe com env inválida (PRD §0.5.6).
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // Banco / filas
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    // Armazenamento de objetos (S3 / MinIO)
    S3_ENDPOINT: z.string().url(),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET_UPLOADS: z.string().min(1),
    S3_BUCKET_APPS: z.string().min(1),
    S3_BUCKET_WORM: z.string().min(1),

    // Autenticação
    JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
    REFRESH_TOKEN_PEPPER: z
      .string()
      .min(16, 'REFRESH_TOKEN_PEPPER deve ter ao menos 16 caracteres'),
    AUTH_ENCRYPTION_KEY: z
      .string()
      .min(32, 'AUTH_ENCRYPTION_KEY deve ter ao menos 32 caracteres'),

    // IA
    AI_PROVIDER: z.enum(['mock', 'anthropic']).default('mock'),
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL_STRUCTURE: z.string().min(1).default('claude-sonnet-5'),
    AI_MODEL_INTERACTIONS: z.string().min(1).default('claude-sonnet-5'),

    // OCR / e-mail
    OCR_PROVIDER: z.enum(['tesseract']).default('tesseract'),
    MAILER: z.enum(['console', 'smtp']).default('console'),
    SMTP_URL: z.string().optional(),

    // URLs públicas
    APP_BASE_URL: z.string().url(),
    ADMIN_BASE_URL: z.string().url(),
    RUNTIME_BASE_URL: z.string().url(),

    // Portas de backend
    API_PORT: z.coerce.number().int().positive().default(3333),
    WORKER_PORT: z.coerce.number().int().positive().default(3334),

    // INPI — parametrizado, nunca hard-coded (PRD Parte 5 §3.8)
    INPI_GRU_FEE_CENTS: z.coerce.number().int().nonnegative().default(21000),
    // Honorários do Registro Assistido (RF-17) — repassado ao cliente separado da GRU.
    INPI_SERVICE_FEE_CENTS: z.coerce.number().int().nonnegative().default(29700),
  })
  .superRefine((val, ctx) => {
    if (val.AI_PROVIDER === 'anthropic' && !val.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ANTHROPIC_API_KEY'],
        message: 'ANTHROPIC_API_KEY é obrigatório quando AI_PROVIDER=anthropic',
      });
    }
    if (val.MAILER === 'smtp' && !val.SMTP_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_URL'],
        message: 'SMTP_URL é obrigatório quando MAILER=smtp',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Valida um objeto de ambiente e lança um erro legível se for inválido. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${details}`);
  }
  return parsed.data;
}

let cached: Env | undefined;

/** Retorna a env validada e memoizada do processo. */
export function getEnv(): Env {
  if (!cached) {
    cached = loadEnv();
  }
  return cached;
}

/** Limpa o cache — uso restrito a testes. */
export function resetEnvCache(): void {
  cached = undefined;
}
