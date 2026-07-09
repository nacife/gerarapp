import type { Role } from '@eduforge/config';
import { Errors } from '../common/errors';
import type { AccessTokenService } from './domain/access-token';
import type { MfaChallengeService } from './domain/challenge-token';
import type { Clock } from './domain/clock';
import { generateToken, hashToken } from './domain/crypto';
import { evaluateLockout, shouldLock } from './domain/lockout';
import type { BreachedPasswordChecker } from './domain/password-policy';
import { validatePasswordStrength } from './domain/password-policy';
import type { PasswordHasher } from './domain/password-hasher';
import type { TotpService } from './domain/totp';
import { verifyMfaCode } from './mfa.util';
import type { AuthUser } from './domain/types';
import type {
  AuthTokenRepository,
  LoginAttemptStore,
  Mailer,
  SessionRepository,
  UserRepository,
} from './ports';

export interface AuthConfig {
  refreshTokenPepper: string;
  encryptionKey: string;
  refreshTtlSec: number;
  emailVerifyTtlSec: number;
  passwordResetTtlSec: number;
  lockDurationSec: number;
  appBaseUrl: string;
}

export interface DeviceInfo {
  ip?: string;
  userAgent?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  /** Presente durante impersonação — banner "Sessão de suporte" (RF-12). */
  impersonatedBy?: { id: string; email: string } | null;
}

export interface SessionSummary {
  id: string;
  device: { ip?: string; userAgent?: string } | null;
  expiresAt: Date;
}

export interface IssuedSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export type LoginResult =
  | { status: 'authenticated'; session: IssuedSession }
  | { status: 'mfa_required'; challengeToken: string };

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    locale: user.locale,
    emailVerified: user.emailVerifiedAt !== null,
    mfaEnabled: user.mfa?.enabled === true,
  };
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly authTokens: AuthTokenRepository,
    private readonly attempts: LoginAttemptStore,
    private readonly mailer: Mailer,
    private readonly hasher: PasswordHasher,
    private readonly breached: BreachedPasswordChecker,
    private readonly totp: TotpService,
    private readonly accessTokens: AccessTokenService,
    private readonly challenge: MfaChallengeService,
    private readonly clock: Clock,
    private readonly config: AuthConfig,
  ) {}

  // ─────────────────────────── Cadastro ───────────────────────────

  async signup(input: {
    email: string;
    password: string;
    name: string;
    locale?: string;
    consentVersion: string;
    ip?: string;
  }): Promise<{ userId: string }> {
    await this.assertPasswordAcceptable(input.password);

    const email = input.email.toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) throw Errors.emailInUse();

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      email,
      name: input.name,
      role: 'creator',
      locale: input.locale ?? 'pt-BR',
      passwordHash,
      consent: {
        version: input.consentVersion,
        acceptedAt: this.clock.now().toISOString(),
        ip: input.ip,
      },
    });

    await this.sendEmailVerification(user);
    return { userId: user.id };
  }

  private async sendEmailVerification(user: AuthUser): Promise<void> {
    const raw = generateToken();
    const tokenHash = hashToken(raw, this.config.refreshTokenPepper);
    await this.authTokens.invalidateForUser(user.id, 'email_verify');
    await this.authTokens.create({
      userId: user.id,
      type: 'email_verify',
      tokenHash,
      expiresAt: new Date(this.clock.nowMs() + this.config.emailVerifyTtlSec * 1000),
    });
    const link = `${this.config.appBaseUrl}/verificar-email?token=${raw}`;
    await this.mailer.send({
      to: user.email,
      subject: 'Confirme seu e-mail — EduForge',
      text: `Olá ${user.name}, confirme seu e-mail: ${link}`,
    });
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken, this.config.refreshTokenPepper);
    const record = await this.authTokens.findValidByHash(tokenHash, 'email_verify', this.clock.now());
    if (!record) throw Errors.invalidToken();
    await this.users.markEmailVerified(record.userId, this.clock.now());
    await this.authTokens.markUsed(record.id, this.clock.now());
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email.toLowerCase());
    if (user && user.emailVerifiedAt === null) {
      await this.sendEmailVerification(user);
    }
  }

  // ─────────────────────────── Login ───────────────────────────

  async login(input: {
    email: string;
    password: string;
    device: DeviceInfo;
  }): Promise<LoginResult> {
    const key = input.email.toLowerCase();
    const nowMs = this.clock.nowMs();

    const snapshot = await this.attempts.get(key);
    const decision = evaluateLockout(snapshot, nowMs);
    if (decision.locked) throw Errors.accountLocked(decision.retryAfterSec);

    const user = await this.users.findByEmail(key);
    const passwordOk =
      user?.passwordHash != null && (await this.hasher.verify(user.passwordHash, input.password));

    if (!user || !passwordOk) {
      const after = await this.attempts.recordFailure(key);
      if (shouldLock(after.failures)) {
        await this.attempts.lock(key, nowMs + this.config.lockDurationSec * 1000);
        throw Errors.accountLocked(this.config.lockDurationSec);
      }
      throw Errors.invalidCredentials(evaluateLockout(after, nowMs).captchaRequired);
    }

    await this.attempts.reset(key);

    if (user.status === 'suspended') throw Errors.accountSuspended();
    if (user.emailVerifiedAt === null) throw Errors.emailNotVerified();

    if (user.mfa?.enabled) {
      return { status: 'mfa_required', challengeToken: this.challenge.sign(user.id) };
    }

    const session = await this.issueSession(user, input.device);
    return { status: 'authenticated', session };
  }

  async loginMfa(input: {
    challengeToken: string;
    code: string;
    device: DeviceInfo;
  }): Promise<IssuedSession> {
    const userId = this.challenge.verify(input.challengeToken);
    if (!userId) throw Errors.invalidToken();
    const user = await this.users.findById(userId);
    if (!user || !user.mfa?.enabled) throw Errors.invalidToken();

    const ok = await this.consumeMfaCode(user, input.code);
    if (!ok) throw Errors.invalidMfaCode();

    return this.issueSession(user, input.device);
  }

  /** Verifica código TOTP ou consome um código de backup. */
  private async consumeMfaCode(user: AuthUser, code: string): Promise<boolean> {
    if (!user.mfa) return false;
    const result = verifyMfaCode(user.mfa, code, this.totp, this.config.encryptionKey);
    if (result.usedBackup) {
      await this.users.setMfa(user.id, {
        ...user.mfa,
        backupCodeHashes: result.remainingBackupHashes,
      });
    }
    return result.ok;
  }

  private async issueSession(user: AuthUser, device: DeviceInfo): Promise<IssuedSession> {
    const accessToken = this.accessTokens.sign({
      sub: user.id,
      role: user.role,
      mfa: user.mfa?.enabled === true,
    });
    const refreshRaw = generateToken();
    const refreshExpiresAt = new Date(this.clock.nowMs() + this.config.refreshTtlSec * 1000);
    await this.sessions.create({
      userId: user.id,
      refreshTokenHash: hashToken(refreshRaw, this.config.refreshTokenPepper),
      expiresAt: refreshExpiresAt,
      device: device.ip || device.userAgent ? device : null,
    });
    return { user: toPublicUser(user), accessToken, refreshToken: refreshRaw, refreshExpiresAt };
  }

  // ───────────────────── Sessões / refresh ─────────────────────

  async refresh(rawRefresh: string, device: DeviceInfo): Promise<IssuedSession> {
    const hash = hashToken(rawRefresh, this.config.refreshTokenPepper);
    const session = await this.sessions.findByRefreshHash(hash);
    const now = this.clock.now();
    if (!session || session.revokedAt || session.expiresAt <= now) throw Errors.unauthorized();

    const user = await this.users.findById(session.userId);
    if (!user || user.status !== 'active') throw Errors.unauthorized();

    // Rotação: revoga a sessão antiga e emite uma nova.
    await this.sessions.revoke(session.id, now);
    return this.issueSession(user, device);
  }

  async logout(rawRefresh: string): Promise<void> {
    const hash = hashToken(rawRefresh, this.config.refreshTokenPepper);
    const session = await this.sessions.findByRefreshHash(hash);
    if (session && !session.revokedAt) {
      await this.sessions.revoke(session.id, this.clock.now());
    }
  }

  async logoutAll(userId: string): Promise<number> {
    return this.sessions.revokeAllForUser(userId, this.clock.now());
  }

  async me(userId: string, impersonatorId?: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw Errors.unauthorized();
    const base = toPublicUser(user);
    if (!impersonatorId) return base;
    const admin = await this.users.findById(impersonatorId);
    return { ...base, impersonatedBy: admin ? { id: admin.id, email: admin.email } : null };
  }

  /** Sessões ativas do usuário — RF-11 ("segurança... sessões ativas"). */
  async listSessions(userId: string): Promise<SessionSummary[]> {
    const sessions = await this.sessions.listActive(userId);
    return sessions.map((s) => ({ id: s.id, device: s.device, expiresAt: s.expiresAt }));
  }

  /** Encerra uma sessão específica (após confirmar que pertence ao usuário). */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const sessions = await this.sessions.listActive(userId);
    if (!sessions.some((s) => s.id === sessionId)) throw Errors.notFound('Sessão');
    await this.sessions.revoke(sessionId, this.clock.now());
  }

  /** Perfil (nome, idioma) — RF-11. */
  async updateProfile(userId: string, patch: { name?: string; locale?: string }): Promise<PublicUser> {
    await this.users.updateProfile(userId, patch);
    return this.me(userId);
  }

  // ───────────────────── Recuperação de senha ─────────────────────

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email.toLowerCase());
    if (!user) return; // não revela existência (anti-enumeração)

    await this.authTokens.invalidateForUser(user.id, 'password_reset');
    const raw = generateToken();
    await this.authTokens.create({
      userId: user.id,
      type: 'password_reset',
      tokenHash: hashToken(raw, this.config.refreshTokenPepper),
      expiresAt: new Date(this.clock.nowMs() + this.config.passwordResetTtlSec * 1000),
    });
    const link = `${this.config.appBaseUrl}/redefinir-senha?token=${raw}`;
    await this.mailer.send({
      to: user.email,
      subject: 'Redefinição de senha — EduForge',
      text: `Para redefinir sua senha (válido por 30 min): ${link}`,
    });
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    await this.assertPasswordAcceptable(newPassword);
    const tokenHash = hashToken(rawToken, this.config.refreshTokenPepper);
    const record = await this.authTokens.findValidByHash(tokenHash, 'password_reset', this.clock.now());
    if (!record) throw Errors.invalidToken();

    const passwordHash = await this.hasher.hash(newPassword);
    await this.users.updatePasswordHash(record.userId, passwordHash);
    await this.authTokens.markUsed(record.id, this.clock.now());
    // Segurança: revoga todas as sessões após troca de senha.
    await this.sessions.revokeAllForUser(record.userId, this.clock.now());
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private async assertPasswordAcceptable(password: string): Promise<void> {
    const policy = validatePasswordStrength(password);
    if (!policy.ok) throw Errors.weakPassword(policy.errors);
    if (await this.breached.isBreached(password)) {
      throw Errors.weakPassword(['Esta senha aparece em vazamentos conhecidos. Escolha outra.']);
    }
  }
}
