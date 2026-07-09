import { randomUUID } from 'node:crypto';
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
import type { PasswordResetTrigger } from '../admin-users.service';

export class InMemoryAuditLogRepository implements AuditLogRepository {
  rows: AuditLogRow[] = [];
  async record(entry: AuditEntry): Promise<void> {
    this.rows.push({ id: randomUUID(), createdAt: new Date(), ...entry });
  }
  async listForTarget(targetType: string, targetId: string, limit: number): Promise<AuditLogRow[]> {
    return this.rows
      .filter((r) => r.targetType === targetType && r.targetId === targetId)
      .slice(0, limit);
  }
  async list(limit: number): Promise<AuditLogRow[]> {
    return this.rows.slice(0, limit);
  }
}

export class InMemoryAdminUserRepository implements AdminUserRepository {
  rows: (AdminUserRow & { creditBalance: number; projectCount: number; planKey: string | null })[] = [];

  seed(input: { email: string; name: string; role: Role }): AdminUserRow {
    const row = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      role: input.role,
      status: 'active' as UserStatus,
      createdAt: new Date(),
      emailVerifiedAt: new Date(),
      creditBalance: 0,
      projectCount: 0,
      planKey: 'free',
    };
    this.rows.push(row);
    return row;
  }

  async search(query?: string, status?: UserStatus): Promise<AdminUserRow[]> {
    return this.rows
      .filter(
        (r) =>
          (!status || r.status === status) &&
          (!query || r.email.includes(query) || r.name.includes(query)),
      )
      .map((r) => ({ ...r }));
  }
  async findById(id: string): Promise<AdminUserRow | null> {
    // Retorna uma CÓPIA (como uma leitura de banco real) — evita que mutações
    // posteriores (setStatus) reflitam retroativamente numa referência já lida.
    const r = this.rows.find((x) => x.id === id);
    return r ? { ...r } : null;
  }
  async getDetail(id: string): Promise<AdminUserDetail | null> {
    const r = this.rows.find((x) => x.id === id);
    return r ? { ...r } : null;
  }
  async setStatus(id: string, status: UserStatus): Promise<void> {
    const r = this.rows.find((x) => x.id === id);
    if (r) r.status = status;
  }
}

export class FakePasswordResetTrigger implements PasswordResetTrigger {
  calls: string[] = [];
  async requestPasswordReset(email: string): Promise<void> {
    this.calls.push(email);
  }
}

export class InMemoryFeatureFlagRepository implements FeatureFlagRepository {
  flags: FeatureFlagRow[] = [];
  assignments: FlagAssignmentRow[] = [];

  async list(): Promise<FeatureFlagRow[]> {
    return this.flags;
  }
  async findByKey(key: string): Promise<FeatureFlagRow | null> {
    return this.flags.find((f) => f.key === key) ?? null;
  }
  async create(input: { key: string; defaultOn: boolean; rolloutPct: number }): Promise<FeatureFlagRow> {
    const row = { id: randomUUID(), ...input };
    this.flags.push(row);
    return row;
  }
  async update(id: string, patch: { defaultOn?: boolean; rolloutPct?: number }): Promise<FeatureFlagRow> {
    const f = this.flags.find((x) => x.id === id)!;
    Object.assign(f, patch);
    return f;
  }
  async findAssignment(flagId: string, subjectType: string, subjectId: string): Promise<FlagAssignmentRow | null> {
    return (
      this.assignments.find(
        (a) => a.flagId === flagId && a.subjectType === subjectType && a.subjectId === subjectId,
      ) ?? null
    );
  }
  async upsertAssignment(input: {
    flagId: string;
    subjectType: 'user' | 'org' | 'plan';
    subjectId: string;
    enabled: boolean;
  }): Promise<FlagAssignmentRow> {
    const existing = this.assignments.find(
      (a) => a.flagId === input.flagId && a.subjectType === input.subjectType && a.subjectId === input.subjectId,
    );
    if (existing) {
      existing.enabled = input.enabled;
      return existing;
    }
    const row = { id: randomUUID(), ...input };
    this.assignments.push(row);
    return row;
  }
  async listAssignments(flagId: string): Promise<FlagAssignmentRow[]> {
    return this.assignments.filter((a) => a.flagId === flagId);
  }
}
