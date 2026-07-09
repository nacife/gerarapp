import type { Role } from '@eduforge/config';
import type { AttemptSnapshot } from './domain/lockout';
import type { AuthUser, ConsentRecord, MfaConfig, SessionRecord } from './domain/types';

export interface CreateUserInput {
  email: string;
  name: string;
  role: Role;
  locale: string;
  passwordHash: string;
  consent: ConsentRecord;
}

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  create(input: CreateUserInput): Promise<AuthUser>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  markEmailVerified(id: string, at: Date): Promise<void>;
  setMfa(id: string, mfa: MfaConfig | null): Promise<void>;
  setStatus(id: string, status: 'active' | 'suspended' | 'pending_deletion'): Promise<void>;
  updateProfile(id: string, patch: { name?: string; locale?: string }): Promise<void>;
}

export interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  device: { ip?: string; userAgent?: string } | null;
}

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<SessionRecord>;
  findByRefreshHash(hash: string): Promise<SessionRecord | null>;
  revoke(id: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<number>;
  /** Sessões ativas (não revogadas, não expiradas) — RF-11 e visão 360º (RF-12). */
  listActive(userId: string): Promise<SessionRecord[]>;
}

export type AuthTokenType = 'email_verify' | 'password_reset';

export interface AuthTokenRepository {
  create(input: {
    userId: string;
    type: AuthTokenType;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findValidByHash(
    tokenHash: string,
    type: AuthTokenType,
    now: Date,
  ): Promise<{ id: string; userId: string } | null>;
  markUsed(id: string, at: Date): Promise<void>;
  invalidateForUser(userId: string, type: AuthTokenType): Promise<void>;
}

export interface LoginAttemptStore {
  get(key: string): Promise<AttemptSnapshot>;
  recordFailure(key: string): Promise<AttemptSnapshot>;
  lock(key: string, untilMs: number): Promise<void>;
  reset(key: string): Promise<void>;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

// ───────────────────── LGPD (§0.5.7) ─────────────────────

export interface AccountExport {
  exportedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    locale: string;
    createdAt: string;
  };
  projects: { id: string; title: string; slug: string; status: string }[];
  subscriptions: { plan: string; status: string }[];
  aiCredits: { balance: number };
}

export interface AccountDataPort {
  exportUserData(userId: string): Promise<AccountExport>;
}

export interface DeletionEnqueuer {
  enqueueAnonymizeUser(userId: string): Promise<void>;
}
