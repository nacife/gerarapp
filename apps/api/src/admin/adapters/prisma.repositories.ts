import { Prisma, prisma } from '@eduforge/db';
import type { Role, UserStatus } from '@eduforge/config';
import type {
  AdminUserDetail,
  AdminUserRepository,
  AdminUserRow,
  AuditEntry,
  AuditLogRepository,
  AuditLogRow,
  FeatureFlagRepository,
  FeatureFlagRow,
  FlagAssignmentRow,
} from '../ports';

export class PrismaAuditLogRepository implements AuditLogRepository {
  /** Escrita append-only — nunca update/delete (imposto também no banco, M6). */
  async record(entry: AuditEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        beforeAfter: (entry.beforeAfter as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
  }

  async listForTarget(targetType: string, targetId: string, limit: number): Promise<AuditLogRow[]> {
    return prisma.auditLog.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async list(limit: number): Promise<AuditLogRow[]> {
    return prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }
}

function mapUserRow(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: Date;
  emailVerifiedAt: Date | null;
}): AdminUserRow {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    status: u.status as UserStatus,
    createdAt: u.createdAt,
    emailVerifiedAt: u.emailVerifiedAt,
  };
}

export class PrismaAdminUserRepository implements AdminUserRepository {
  async search(query: string | undefined, status: UserStatus | undefined, limit: number): Promise<AdminUserRow[]> {
    const rows = await prisma.user.findMany({
      where: {
        status,
        OR: query
          ? [{ email: { contains: query, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapUserRow);
  }

  async findById(id: string): Promise<AdminUserRow | null> {
    const u = await prisma.user.findUnique({ where: { id } });
    return u ? mapUserRow(u) : null;
  }

  async getDetail(id: string): Promise<AdminUserDetail | null> {
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return null;
    const [projectCount, subscription, creditAgg] = await Promise.all([
      prisma.project.count({ where: { ownerUserId: id } }),
      prisma.subscription.findFirst({
        where: { userId: id, status: 'active' },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.aiCreditLedger.aggregate({ where: { userId: id }, _sum: { delta: true } }),
    ]);
    return {
      ...mapUserRow(u),
      projectCount,
      planKey: subscription?.plan.key ?? null,
      creditBalance: creditAgg._sum.delta ?? 0,
    };
  }

  async setStatus(id: string, status: UserStatus): Promise<void> {
    await prisma.user.update({ where: { id }, data: { status } });
  }
}

function mapFlag(f: { id: string; key: string; defaultOn: boolean; rolloutPct: number }): FeatureFlagRow {
  return f;
}
function mapAssignment(a: {
  id: string;
  flagId: string;
  subjectType: string;
  subjectId: string;
  enabled: boolean;
}): FlagAssignmentRow {
  return { ...a, subjectType: a.subjectType as FlagAssignmentRow['subjectType'] };
}

export class PrismaFeatureFlagRepository implements FeatureFlagRepository {
  async list(): Promise<FeatureFlagRow[]> {
    const rows = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    return rows.map(mapFlag);
  }
  async findByKey(key: string): Promise<FeatureFlagRow | null> {
    const f = await prisma.featureFlag.findUnique({ where: { key } });
    return f ? mapFlag(f) : null;
  }
  async create(input: { key: string; defaultOn: boolean; rolloutPct: number }): Promise<FeatureFlagRow> {
    const f = await prisma.featureFlag.create({ data: input });
    return mapFlag(f);
  }
  async update(id: string, patch: { defaultOn?: boolean; rolloutPct?: number }): Promise<FeatureFlagRow> {
    const f = await prisma.featureFlag.update({ where: { id }, data: patch });
    return mapFlag(f);
  }
  async findAssignment(flagId: string, subjectType: string, subjectId: string): Promise<FlagAssignmentRow | null> {
    const a = await prisma.flagAssignment.findFirst({
      where: { flagId, subjectType: subjectType as never, subjectId },
    });
    return a ? mapAssignment(a) : null;
  }
  async upsertAssignment(input: {
    flagId: string;
    subjectType: 'user' | 'org' | 'plan';
    subjectId: string;
    enabled: boolean;
  }): Promise<FlagAssignmentRow> {
    const a = await prisma.flagAssignment.upsert({
      where: {
        flagId_subjectType_subjectId: {
          flagId: input.flagId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
        },
      },
      update: { enabled: input.enabled },
      create: input,
    });
    return mapAssignment(a);
  }
  async listAssignments(flagId: string): Promise<FlagAssignmentRow[]> {
    const rows = await prisma.flagAssignment.findMany({ where: { flagId } });
    return rows.map(mapAssignment);
  }
}
