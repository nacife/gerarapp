import { randomUUID } from 'node:crypto';
import { JwtAccessTokenService } from '../domain/access-token';
import { JwtMfaChallengeService } from '../domain/challenge-token';
import type { Clock } from '../domain/clock';
import { LocalBreachedPasswordChecker } from '../domain/password-policy';
import type { PasswordHasher } from '../domain/password-hasher';
import type { TotpService } from '../domain/totp';
import type { AuthUser, MfaConfig } from '../domain/types';
import type { AttemptSnapshot } from '../domain/lockout';
import { AuthService, type AuthConfig } from '../auth.service';
import { MfaService } from '../mfa.service';
import { AccountService } from '../account.service';
import type {
  AccountDataPort,
  AccountExport,
  AuthTokenRepository,
  AuthTokenType,
  CreateSessionInput,
  CreateUserInput,
  DeletionEnqueuer,
  LoginAttemptStore,
  MailMessage,
  Mailer,
  SessionRepository,
  UserRepository,
} from '../ports';
import type { SessionRecord } from '../domain/types';

const WINDOW_MS = 10 * 60 * 1000;

export class FixedClock implements Clock {
  constructor(private ms: number = Date.UTC(2026, 6, 5, 12, 0, 0)) {}
  now(): Date {
    return new Date(this.ms);
  }
  nowMs(): number {
    return this.ms;
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

/** Hasher rápido e determinístico para testes (não use em produção). */
export class FakeHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }
  async verify(hashed: string, password: string): Promise<boolean> {
    return hashed === `hashed:${password}`;
  }
}

/** TOTP fake: aceita o código "123456"; segredo fixo. */
export class FakeTotp implements TotpService {
  generateSecret(): string {
    return 'JBSWY3DPEHPK3PXP';
  }
  keyUri(accountName: string, issuer: string, secret: string): string {
    return `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}`;
  }
  verify(token: string): boolean {
    return token === '123456';
  }
}

export class InMemoryUserRepository implements UserRepository {
  private byId = new Map<string, AuthUser>();

  seed(user: AuthUser): void {
    this.byId.set(user.id, user);
  }
  async findByEmail(email: string): Promise<AuthUser | null> {
    for (const u of this.byId.values()) if (u.email === email) return { ...u };
    return null;
  }
  async findById(id: string): Promise<AuthUser | null> {
    const u = this.byId.get(id);
    return u ? { ...u } : null;
  }
  async create(input: CreateUserInput): Promise<AuthUser> {
    const user: AuthUser = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      role: input.role,
      locale: input.locale,
      passwordHash: input.passwordHash,
      status: 'active',
      emailVerifiedAt: null,
      mfa: null,
    };
    this.byId.set(user.id, user);
    return { ...user };
  }
  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const u = this.byId.get(id);
    if (u) u.passwordHash = passwordHash;
  }
  async markEmailVerified(id: string, at: Date): Promise<void> {
    const u = this.byId.get(id);
    if (u) u.emailVerifiedAt = at;
  }
  async setMfa(id: string, mfa: MfaConfig | null): Promise<void> {
    const u = this.byId.get(id);
    if (u) u.mfa = mfa;
  }
  async setStatus(id: string, status: AuthUser['status']): Promise<void> {
    const u = this.byId.get(id);
    if (u) u.status = status;
  }
  async updateProfile(id: string, patch: { name?: string; locale?: string }): Promise<void> {
    const u = this.byId.get(id);
    if (u) Object.assign(u, patch);
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private byId = new Map<string, SessionRecord>();

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    const s: SessionRecord = {
      id: randomUUID(),
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      device: input.device,
    };
    this.byId.set(s.id, s);
    return { ...s };
  }
  async findByRefreshHash(hash: string): Promise<SessionRecord | null> {
    for (const s of this.byId.values()) if (s.refreshTokenHash === hash) return { ...s };
    return null;
  }
  async revoke(id: string, at: Date): Promise<void> {
    const s = this.byId.get(id);
    if (s) s.revokedAt = at;
  }
  async revokeAllForUser(userId: string, at: Date): Promise<number> {
    let n = 0;
    for (const s of this.byId.values())
      if (s.userId === userId && !s.revokedAt) {
        s.revokedAt = at;
        n++;
      }
    return n;
  }
  async listActive(userId: string): Promise<SessionRecord[]> {
    const now = Date.now();
    return [...this.byId.values()].filter(
      (s) => s.userId === userId && !s.revokedAt && s.expiresAt.getTime() > now,
    );
  }
  countActive(userId: string): number {
    let n = 0;
    for (const s of this.byId.values()) if (s.userId === userId && !s.revokedAt) n++;
    return n;
  }
}

export class InMemoryAuthTokenRepository implements AuthTokenRepository {
  private rows: {
    id: string;
    userId: string;
    type: AuthTokenType;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  }[] = [];

  async create(input: {
    userId: string;
    type: AuthTokenType;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    this.rows.push({ id: randomUUID(), usedAt: null, ...input });
  }
  async findValidByHash(
    tokenHash: string,
    type: AuthTokenType,
    now: Date,
  ): Promise<{ id: string; userId: string } | null> {
    const row = this.rows.find(
      (r) => r.tokenHash === tokenHash && r.type === type && !r.usedAt && r.expiresAt > now,
    );
    return row ? { id: row.id, userId: row.userId } : null;
  }
  async markUsed(id: string, at: Date): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.usedAt = at;
  }
  async invalidateForUser(userId: string, type: AuthTokenType): Promise<void> {
    const now = new Date();
    for (const r of this.rows) if (r.userId === userId && r.type === type && !r.usedAt) r.usedAt = now;
  }
}

export class InMemoryLoginAttemptStore implements LoginAttemptStore {
  private map = new Map<string, { failures: number; firstAt: number; lockedUntil: number | null }>();
  constructor(private readonly clock: Clock) {}

  async get(key: string): Promise<AttemptSnapshot> {
    const e = this.map.get(key);
    if (!e) return { failures: 0, lockedUntil: null };
    return { failures: e.failures, lockedUntil: e.lockedUntil };
  }
  async recordFailure(key: string): Promise<AttemptSnapshot> {
    const now = this.clock.nowMs();
    let e = this.map.get(key);
    if (!e || now - e.firstAt > WINDOW_MS) e = { failures: 0, firstAt: now, lockedUntil: null };
    e.failures += 1;
    this.map.set(key, e);
    return { failures: e.failures, lockedUntil: e.lockedUntil };
  }
  async lock(key: string, untilMs: number): Promise<void> {
    const e = this.map.get(key) ?? { failures: 0, firstAt: this.clock.nowMs(), lockedUntil: null };
    e.lockedUntil = untilMs;
    this.map.set(key, e);
  }
  async reset(key: string): Promise<void> {
    this.map.delete(key);
  }
}

export class FakeMailer implements Mailer {
  sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
  lastLink(): string | undefined {
    const last = this.sent.at(-1);
    return last?.text.match(/https?:\/\/\S+/)?.[0];
  }
}

class FakeAccountData implements AccountDataPort {
  constructor(private readonly users: InMemoryUserRepository) {}
  async exportUserData(userId: string): Promise<AccountExport> {
    const user = await this.users.findById(userId);
    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: user!.role,
        locale: user!.locale,
        createdAt: new Date().toISOString(),
      },
      projects: [],
      subscriptions: [],
      aiCredits: { balance: 0 },
    };
  }
}

export class FakeDeletionEnqueuer implements DeletionEnqueuer {
  enqueued: string[] = [];
  async enqueueAnonymizeUser(userId: string): Promise<void> {
    this.enqueued.push(userId);
  }
}

const TEST_SECRET = 'test-jwt-secret-0123456789-abcdefghij';
const TEST_PEPPER = 'test-refresh-pepper-0123456789';
const TEST_ENC_KEY = 'test-encryption-key-0123456789-abcdef';

export function buildAuthService() {
  const clock = new FixedClock();
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const authTokens = new InMemoryAuthTokenRepository();
  const attempts = new InMemoryLoginAttemptStore(clock);
  const mailer = new FakeMailer();
  const totp = new FakeTotp();
  const deletion = new FakeDeletionEnqueuer();

  const config: AuthConfig = {
    refreshTokenPepper: TEST_PEPPER,
    encryptionKey: TEST_ENC_KEY,
    refreshTtlSec: 3600,
    emailVerifyTtlSec: 3600,
    passwordResetTtlSec: 1800,
    lockDurationSec: 900,
    appBaseUrl: 'http://localhost:3000',
  };

  const service = new AuthService(
    users,
    sessions,
    authTokens,
    attempts,
    mailer,
    new FakeHasher(),
    new LocalBreachedPasswordChecker(),
    totp,
    new JwtAccessTokenService(TEST_SECRET, 900),
    new JwtMfaChallengeService(TEST_SECRET, 300),
    clock,
    config,
  );

  const mfaService = new MfaService(users, totp, TEST_ENC_KEY);
  const accountService = new AccountService(
    users,
    sessions,
    new FakeAccountData(users),
    deletion,
    clock,
  );

  return { service, mfaService, accountService, users, sessions, authTokens, mailer, deletion, clock };
}
