import type { UserStatus } from '@eduforge/config';
import { Errors } from '../common/errors';
import type { AccessTokenService } from '../auth/domain/access-token';
import type { SessionRepository } from '../auth/ports';
import type { CreditRepository } from '../interactions/ports';
import type { AuditService } from './audit.service';
import type { AdminUserDetail, AdminUserRepository, AdminUserRow } from './ports';

export interface AdminActor {
  id: string;
  role: string;
}

/** Fronteira estreita com o módulo de auth — evita depender da classe concreta. */
export interface PasswordResetTrigger {
  requestPasswordReset(email: string): Promise<void>;
}

export class AdminUsersService {
  constructor(
    private readonly users: AdminUserRepository,
    private readonly sessions: SessionRepository,
    private readonly credits: CreditRepository,
    private readonly audit: AuditService,
    private readonly auth: PasswordResetTrigger,
    private readonly accessTokens: AccessTokenService,
  ) {}

  search(query?: string, status?: UserStatus, limit = 50): Promise<AdminUserRow[]> {
    return this.users.search(query, status, limit);
  }

  async get360(id: string): Promise<AdminUserDetail> {
    const detail = await this.users.getDetail(id);
    if (!detail) throw Errors.notFound('Usuário');
    return detail;
  }

  /** Suspende a conta, revoga sessões e registra trilha com antes/depois (US-ADM-01). */
  async suspend(actor: AdminActor, targetId: string, reason: string): Promise<void> {
    const user = await this.users.findById(targetId);
    if (!user) throw Errors.notFound('Usuário');

    await this.users.setStatus(targetId, 'suspended');
    await this.sessions.revokeAllForUser(targetId, new Date());

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'user.suspend',
      targetType: 'user',
      targetId,
      beforeAfter: { before: { status: user.status }, after: { status: 'suspended' }, reason },
    });
  }

  async reactivate(actor: AdminActor, targetId: string): Promise<void> {
    const user = await this.users.findById(targetId);
    if (!user) throw Errors.notFound('Usuário');

    await this.users.setStatus(targetId, 'active');

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'user.reactivate',
      targetType: 'user',
      targetId,
      beforeAfter: { before: { status: user.status }, after: { status: 'active' } },
    });
  }

  async forcePasswordReset(actor: AdminActor, targetId: string): Promise<void> {
    const user = await this.users.findById(targetId);
    if (!user) throw Errors.notFound('Usuário');

    await this.auth.requestPasswordReset(user.email);

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'user.force_password_reset',
      targetType: 'user',
      targetId,
      beforeAfter: null,
    });
  }

  async revokeSessions(actor: AdminActor, targetId: string): Promise<{ revoked: number }> {
    const user = await this.users.findById(targetId);
    if (!user) throw Errors.notFound('Usuário');

    const count = await this.sessions.revokeAllForUser(targetId, new Date());

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'user.revoke_sessions',
      targetType: 'user',
      targetId,
      beforeAfter: { after: { revokedCount: count } },
    });
    return { revoked: count };
  }

  async grantCredits(actor: AdminActor, targetId: string, delta: number, reason: string): Promise<void> {
    const user = await this.users.findById(targetId);
    if (!user) throw Errors.notFound('Usuário');

    await this.credits.grant(targetId, delta, 'grant');

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'user.credit_grant',
      targetType: 'user',
      targetId,
      beforeAfter: { after: { delta, reason } },
    });
  }

  /** Emite um access token de impersonação e registra a sessão de suporte (US-ADM-01). */
  async impersonate(actor: AdminActor, targetId: string): Promise<{ token: string }> {
    const user = await this.users.findById(targetId);
    if (!user) throw Errors.notFound('Usuário');
    if (user.role !== 'creator' && user.role !== 'org_admin') {
      throw Errors.conflict('Só é possível impersonar contas de criador.');
    }

    const token = this.accessTokens.sign({
      sub: user.id,
      role: user.role,
      mfa: true,
      impersonatorId: actor.id,
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'user.impersonate_start',
      targetType: 'user',
      targetId,
      beforeAfter: { after: { targetEmail: user.email } },
    });

    return { token };
  }
}
