/**
 * Constantes de domínio compartilhadas (papéis, planos, status).
 * Nomes técnicos em inglês (PRD §0.6).
 */

export const ROLES = [
  'learner',
  'creator',
  'org_admin',
  'support',
  'admin',
  'super_admin',
] as const;
export type Role = (typeof ROLES)[number];

/** Papéis com acesso ao Admin Console (PRD Parte 7). */
export const ADMIN_ROLES: readonly Role[] = ['support', 'admin', 'super_admin'];

export const PLAN_KEYS = ['free', 'pro', 'business'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const USER_STATUS = ['active', 'suspended', 'pending_deletion'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const PROJECT_STATUS = ['draft', 'published', 'unpublished', 'blocked'] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

export const ACCESS_MODES = ['public', 'link', 'password', 'invite'] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export const APP_VERSION_STATUS = ['building', 'published', 'rolled_back'] as const;
export type AppVersionStatus = (typeof APP_VERSION_STATUS)[number];

/** Ordem de precedência dos planos, para checagens de tier mínimo. */
export const PLAN_TIER: Record<PlanKey, number> = {
  free: 0,
  pro: 1,
  business: 2,
};

/** Custos de crédito de IA (razão contábil, §0.5.4). */
export const AI_CREDITS = {
  costPerInteraction: 3,
  /** Custo por pergunta ao Sensei (RF-06.1) — debitado do dono do projeto. */
  costTutorQuestion: 1,
  /** Custo por geração de podcast por capítulo (RF-06.5). */
  costPodcast: 5,
  /** Custo por geração de ilustração IA (M10 "imagens IA"). */
  costIllustration: 2,
  /** Abaixo disto dispara o webhook credits.low_balance (Parte 6.B.4) — limiar por usuário fica para quando houver a configuração. */
  lowBalanceThreshold: 30,
} as const;

/** Filas BullMQ compartilhadas entre api (produtor) e worker (consumidor). */
export const QUEUES = {
  ingest: 'ingest',
  generate: 'generate',
  tts: 'tts',
  inpiPackage: 'inpi-package',
  system: 'system',
  anonymize: 'account-anonymize',
  webhookDelivery: 'webhook-delivery',
  senseiEmbed: 'sensei-embed',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Parâmetros de autenticação (RF-07 + Gherkin Épico 5). */
export const AUTH = {
  /** Access token JWT de curta duração. */
  accessTokenTtlSec: 15 * 60,
  /** Refresh token rotativo. */
  refreshTokenTtlSec: 30 * 24 * 60 * 60,
  /** Verificação de e-mail. */
  emailVerifyTtlSec: 24 * 60 * 60,
  /** Recuperação de senha — expiração de 30 minutos (RF-07). */
  passwordResetTtlSec: 30 * 60,
  /** Política mínima de senha (RF-07). */
  minPasswordLength: 10,
  /** Bloqueio progressivo (Gherkin: 5ª falha → CAPTCHA; 10ª → bloqueio 15 min). */
  lockout: {
    captchaThreshold: 5,
    lockThreshold: 10,
    windowSec: 10 * 60,
    lockDurationSec: 15 * 60,
  },
} as const;

/** Auth do aprendiz ("conta leve" — RF-04/RF-05): token único, sem refresh rotativo. */
export const LEARNER_AUTH = {
  accessTokenTtlSec: 30 * 24 * 60 * 60,
} as const;
