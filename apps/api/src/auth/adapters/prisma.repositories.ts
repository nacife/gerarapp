import { Prisma, prisma } from '@eduforge/db';
import type { Role, UserStatus } from '@eduforge/config';
import type { AuthUser, MfaConfig, SessionRecord } from '../domain/types';
import type {
  AccountDataPort,
  AccountExport,
  AuthTokenRepository,
  AuthTokenType,
  CreateSessionInput,
  CreateUserInput,
  SessionRepository,
  UserRepository,
} from '../ports';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  locale: string;
  passwordHash: string | null;
  status: string;
  emailVerifiedAt: Date | null;
  mfa: Prisma.JsonValue;
};

function mapUser(u: UserRow): AuthUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    locale: u.locale,
    passwordHash: u.passwordHash,
    status: u.status as UserStatus,
    emailVerifiedAt: u.emailVerifiedAt,
    mfa: (u.mfa as unknown as MfaConfig | null) ?? null,
  };
}

export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<AuthUser | null> {
    const u = await prisma.user.findUnique({ where: { email } });
    return u ? mapUser(u) : null;
  }
  async findById(id: string): Promise<AuthUser | null> {
    const u = await prisma.user.findUnique({ where: { id } });
    return u ? mapUser(u) : null;
  }
  async create(input: CreateUserInput): Promise<AuthUser> {
    const u = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        locale: input.locale,
        passwordHash: input.passwordHash,
        consent: input.consent as unknown as Prisma.InputJsonValue,
      },
    });
    return mapUser(u);
  }
  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { passwordHash } });
  }
  async markEmailVerified(id: string, at: Date): Promise<void> {
    await prisma.user.update({ where: { id }, data: { emailVerifiedAt: at } });
  }
  async setMfa(id: string, mfa: MfaConfig | null): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { mfa: mfa === null ? Prisma.DbNull : (mfa as unknown as Prisma.InputJsonValue) },
    });
  }
  async setStatus(id: string, status: UserStatus): Promise<void> {
    await prisma.user.update({ where: { id }, data: { status } });
  }
  async updateProfile(id: string, patch: { name?: string; locale?: string }): Promise<void> {
    await prisma.user.update({ where: { id }, data: patch });
  }
}

function mapSession(s: {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  device: Prisma.JsonValue;
}): SessionRecord {
  return {
    id: s.id,
    userId: s.userId,
    refreshTokenHash: s.refreshTokenHash,
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt,
    device: (s.device as unknown as SessionRecord['device']) ?? null,
  };
}

export class PrismaSessionRepository implements SessionRepository {
  async create(input: CreateSessionInput): Promise<SessionRecord> {
    const s = await prisma.session.create({
      data: {
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        device: (input.device as unknown as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
    return mapSession(s);
  }
  async findByRefreshHash(hash: string): Promise<SessionRecord | null> {
    const s = await prisma.session.findFirst({ where: { refreshTokenHash: hash } });
    return s ? mapSession(s) : null;
  }
  async revoke(id: string, at: Date): Promise<void> {
    await prisma.session.update({ where: { id }, data: { revokedAt: at } });
  }
  async revokeAllForUser(userId: string, at: Date): Promise<number> {
    const res = await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
    return res.count;
  }
  async listActive(userId: string): Promise<SessionRecord[]> {
    const rows = await prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapSession);
  }
}

export class PrismaAuthTokenRepository implements AuthTokenRepository {
  async create(input: {
    userId: string;
    type: AuthTokenType;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.authToken.create({ data: input });
  }
  async findValidByHash(
    tokenHash: string,
    type: AuthTokenType,
    now: Date,
  ): Promise<{ id: string; userId: string } | null> {
    const row = await prisma.authToken.findFirst({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
      select: { id: true, userId: true },
    });
    return row ?? null;
  }
  async markUsed(id: string, at: Date): Promise<void> {
    await prisma.authToken.update({ where: { id }, data: { usedAt: at } });
  }
  async invalidateForUser(userId: string, type: AuthTokenType): Promise<void> {
    await prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}

export class PrismaAccountData implements AccountDataPort {
  async exportUserData(userId: string): Promise<AccountExport> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const projects = await prisma.project.findMany({
      where: { ownerUserId: userId },
      select: { id: true, title: true, slug: true, status: true },
    });
    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
    });
    const credits = await prisma.aiCreditLedger.aggregate({
      where: { userId },
      _sum: { delta: true },
    });
    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
        locale: user.locale,
        createdAt: user.createdAt.toISOString(),
      },
      projects,
      subscriptions: subscriptions.map((s) => ({ plan: s.plan.key, status: s.status })),
      aiCredits: { balance: credits._sum.delta ?? 0 },
    };
  }
}
