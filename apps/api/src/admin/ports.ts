import type { Role, UserStatus } from '@eduforge/config';

export interface AuditEntry {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  beforeAfter: Record<string, unknown> | null;
}

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  beforeAfter: unknown;
  createdAt: Date;
}

/** Escrita append-only (nunca update/delete — imposto também no banco, M6). */
export interface AuditLogRepository {
  record(entry: AuditEntry): Promise<void>;
  listForTarget(targetType: string, targetId: string, limit: number): Promise<AuditLogRow[]>;
  list(limit: number): Promise<AuditLogRow[]>;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  emailVerifiedAt: Date | null;
}

export interface AdminUserDetail extends AdminUserRow {
  projectCount: number;
  planKey: string | null;
  creditBalance: number;
}

export interface AdminUserRepository {
  search(query: string | undefined, status: UserStatus | undefined, limit: number): Promise<AdminUserRow[]>;
  findById(id: string): Promise<AdminUserRow | null>;
  getDetail(id: string): Promise<AdminUserDetail | null>;
  setStatus(id: string, status: UserStatus): Promise<void>;
}

export interface FeatureFlagRow {
  id: string;
  key: string;
  defaultOn: boolean;
  rolloutPct: number;
}

export interface FlagAssignmentRow {
  id: string;
  flagId: string;
  subjectType: 'user' | 'org' | 'plan';
  subjectId: string;
  enabled: boolean;
}

export interface FeatureFlagRepository {
  list(): Promise<FeatureFlagRow[]>;
  findByKey(key: string): Promise<FeatureFlagRow | null>;
  create(input: { key: string; defaultOn: boolean; rolloutPct: number }): Promise<FeatureFlagRow>;
  update(id: string, patch: { defaultOn?: boolean; rolloutPct?: number }): Promise<FeatureFlagRow>;
  findAssignment(
    flagId: string,
    subjectType: string,
    subjectId: string,
  ): Promise<FlagAssignmentRow | null>;
  upsertAssignment(input: {
    flagId: string;
    subjectType: 'user' | 'org' | 'plan';
    subjectId: string;
    enabled: boolean;
  }): Promise<FlagAssignmentRow>;
  listAssignments(flagId: string): Promise<FlagAssignmentRow[]>;
}
