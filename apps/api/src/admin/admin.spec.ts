import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { JwtAccessTokenService } from '../auth/domain/access-token';
import { InMemorySessionRepository } from '../auth/testing/fakes';
import { AppError } from '../common/errors';
import type { CreditRepository, LedgerEntry } from '../interactions/ports';
import { AdminUsersService, type AdminActor } from './admin-users.service';
import { AuditService } from './audit.service';
import { FeatureFlagsService } from './feature-flags.service';
import {
  FakePasswordResetTrigger,
  InMemoryAdminUserRepository,
  InMemoryAuditLogRepository,
  InMemoryFeatureFlagRepository,
} from './testing/fakes';

class FakeCredits implements CreditRepository {
  grants: { userId: string; delta: number }[] = [];
  async balance(): Promise<number> {
    return this.grants.reduce((s, g) => s + g.delta, 0);
  }
  async ledger(): Promise<LedgerEntry[]> {
    return [];
  }
  async grant(userId: string, delta: number): Promise<void> {
    this.grants.push({ userId, delta });
  }
}

const ADMIN: AdminActor = { id: 'admin-1', role: 'admin' };

async function expectError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('esperava AppError');
}

function build() {
  const users = new InMemoryAdminUserRepository();
  const sessions = new InMemorySessionRepository();
  const credits = new FakeCredits();
  const auditRepo = new InMemoryAuditLogRepository();
  const audit = new AuditService(auditRepo);
  const passwordReset = new FakePasswordResetTrigger();
  const tokens = new JwtAccessTokenService('test-secret-0123456789-abcdefghij', 900);

  const service = new AdminUsersService(users, sessions, credits, audit, passwordReset, tokens);
  return { service, users, sessions, credits, auditRepo, audit, passwordReset, tokens };
}

describe('AdminUsersService.suspend (US-ADM-01)', () => {
  let kit: ReturnType<typeof build>;
  let target: ReturnType<InMemoryAdminUserRepository['seed']>;

  beforeEach(() => {
    kit = build();
    target = kit.users.seed({ email: 'rafael@exemplo.com', name: 'Rafael', role: 'creator' });
  });

  it('suspende, revoga sessões e grava audit_log com antes/depois', async () => {
    await kit.sessions.create({ userId: target.id, refreshTokenHash: 'h1', expiresAt: new Date(Date.now() + 999999), device: null });
    await kit.sessions.create({ userId: target.id, refreshTokenHash: 'h2', expiresAt: new Date(Date.now() + 999999), device: null });

    await kit.service.suspend(ADMIN, target.id, 'chargeback');

    const updated = await kit.users.findById(target.id);
    expect(updated?.status).toBe('suspended');
    expect(await kit.sessions.listActive(target.id)).toHaveLength(0);

    const logs = await kit.auditRepo.listForTarget('user', target.id, 10);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe('user.suspend');
    expect(logs[0]!.actorId).toBe(ADMIN.id);
    const detail = logs[0]!.beforeAfter as { before: { status: string }; after: { status: string }; reason: string };
    expect(detail.before.status).toBe('active');
    expect(detail.after.status).toBe('suspended');
    expect(detail.reason).toBe('chargeback');
  });

  it('reativar volta o status para active e também audita', async () => {
    await kit.service.suspend(ADMIN, target.id, 'x');
    await kit.service.reactivate(ADMIN, target.id);
    const updated = await kit.users.findById(target.id);
    expect(updated?.status).toBe('active');
    const logs = await kit.auditRepo.listForTarget('user', target.id, 10);
    expect(logs.some((l) => l.action === 'user.reactivate')).toBe(true);
  });

  it('usuário inexistente é rejeitado', async () => {
    const err = await expectError(() => kit.service.suspend(ADMIN, randomUUID(), 'x'));
    expect(err.slug).toBe('not-found');
  });
});

describe('AdminUsersService — sessões, senha, créditos', () => {
  let kit: ReturnType<typeof build>;
  let target: ReturnType<InMemoryAdminUserRepository['seed']>;

  beforeEach(() => {
    kit = build();
    target = kit.users.seed({ email: 'marina@exemplo.com', name: 'Marina', role: 'creator' });
  });

  it('revokeSessions encerra e retorna a contagem, com auditoria', async () => {
    await kit.sessions.create({ userId: target.id, refreshTokenHash: 'a', expiresAt: new Date(Date.now() + 999999), device: null });
    const res = await kit.service.revokeSessions(ADMIN, target.id);
    expect(res.revoked).toBe(1);
    expect(await kit.auditRepo.listForTarget('user', target.id, 10)).toHaveLength(1);
  });

  it('forcePasswordReset aciona o fluxo de reset e audita', async () => {
    await kit.service.forcePasswordReset(ADMIN, target.id);
    expect(kit.passwordReset.calls).toContain('marina@exemplo.com');
    expect(await kit.auditRepo.listForTarget('user', target.id, 10)).toHaveLength(1);
  });

  it('grantCredits lança no razão e audita o delta/motivo', async () => {
    await kit.service.grantCredits(ADMIN, target.id, 200, 'cortesia');
    expect(await kit.credits.balance()).toBe(200);
    const logs = await kit.auditRepo.listForTarget('user', target.id, 10);
    const detail = logs[0]!.beforeAfter as { after: { delta: number; reason: string } };
    expect(detail.after).toEqual({ delta: 200, reason: 'cortesia' });
  });
});

describe('AdminUsersService.impersonate (US-ADM-01)', () => {
  it('emite token com impersonatorId e audita o início da sessão', async () => {
    const kit = build();
    const target = kit.users.seed({ email: 'marina@exemplo.com', name: 'Marina', role: 'creator' });

    const { token } = await kit.service.impersonate(ADMIN, target.id);
    const claims = kit.tokens.verify(token);
    expect(claims?.sub).toBe(target.id);
    expect(claims?.impersonatorId).toBe(ADMIN.id);

    const logs = await kit.auditRepo.listForTarget('user', target.id, 10);
    expect(logs.some((l) => l.action === 'user.impersonate_start')).toBe(true);
  });

  it('não permite impersonar admin/support (só criadores)', async () => {
    const kit = build();
    const otherAdmin = kit.users.seed({ email: 'outro-admin@eduforge.app', name: 'Outro', role: 'admin' });
    const err = await expectError(() => kit.service.impersonate(ADMIN, otherAdmin.id));
    expect(err.slug).toBe('conflict');
  });
});

describe('FeatureFlagsService (US-ADM-01 rollout parcial)', () => {
  function buildFlags() {
    const repo = new InMemoryFeatureFlagRepository();
    const audit = new AuditService(new InMemoryAuditLogRepository());
    return { service: new FeatureFlagsService(repo, audit), repo };
  }

  it('cria a flag e avalia ~10% de rollout de forma determinística', async () => {
    const { service } = buildFlags();
    await service.create(ADMIN, { key: 'modo_historia', defaultOn: false, rolloutPct: 10 });

    const ids = Array.from({ length: 3000 }, () => randomUUID());
    const results = await Promise.all(ids.map((id) => service.isEnabled('modo_historia', id)));
    const pct = (results.filter(Boolean).length / ids.length) * 100;
    expect(pct).toBeGreaterThan(7);
    expect(pct).toBeLessThan(13);
  });

  it('fixar enabled=true para um usuário de teste sempre vence o rollout', async () => {
    const { service } = buildFlags();
    await service.create(ADMIN, { key: 'modo_historia', defaultOn: false, rolloutPct: 0 });
    const testUserId = randomUUID();

    expect(await service.isEnabled('modo_historia', testUserId)).toBe(false);
    await service.pinForSubject(ADMIN, 'modo_historia', 'user', testUserId, true);
    expect(await service.isEnabled('modo_historia', testUserId)).toBe(true);
  });

  it('criar flag duplicada é rejeitado', async () => {
    const { service } = buildFlags();
    await service.create(ADMIN, { key: 'x', defaultOn: false, rolloutPct: 0 });
    const err = await expectError(() => service.create(ADMIN, { key: 'x', defaultOn: false, rolloutPct: 0 }));
    expect(err.slug).toBe('conflict');
  });
});
