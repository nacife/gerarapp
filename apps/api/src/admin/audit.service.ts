import type { AuditEntry, AuditLogRepository } from './ports';

/** Fachada fina sobre a escrita append-only de audit_logs (PRD §0.5.2). */
export class AuditService {
  constructor(private readonly repo: AuditLogRepository) {}

  record(entry: AuditEntry): Promise<void> {
    return this.repo.record(entry);
  }

  listForTarget(targetType: string, targetId: string, limit = 50) {
    return this.repo.listForTarget(targetType, targetId, limit);
  }

  list(limit = 100) {
    return this.repo.list(limit);
  }
}
