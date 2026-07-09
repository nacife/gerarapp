import { Errors } from '../common/errors';
import { evaluateFlag } from './domain/feature-flags';
import type { AuditService } from './audit.service';
import type { AdminActor } from './admin-users.service';
import type { FeatureFlagRepository, FeatureFlagRow, FlagAssignmentRow } from './ports';

export class FeatureFlagsService {
  constructor(
    private readonly repo: FeatureFlagRepository,
    private readonly audit: AuditService,
  ) {}

  list(): Promise<FeatureFlagRow[]> {
    return this.repo.list();
  }

  async create(
    actor: AdminActor,
    input: { key: string; defaultOn: boolean; rolloutPct: number },
  ): Promise<FeatureFlagRow> {
    const existing = await this.repo.findByKey(input.key);
    if (existing) throw Errors.conflict(`Flag "${input.key}" já existe.`);
    const flag = await this.repo.create(input);
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'flag.create',
      targetType: 'feature_flag',
      targetId: flag.id,
      beforeAfter: { after: input },
    });
    return flag;
  }

  async update(
    actor: AdminActor,
    key: string,
    patch: { defaultOn?: boolean; rolloutPct?: number },
  ): Promise<FeatureFlagRow> {
    const flag = await this.repo.findByKey(key);
    if (!flag) throw Errors.notFound('Feature flag');
    const updated = await this.repo.update(flag.id, patch);
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'flag.update',
      targetType: 'feature_flag',
      targetId: flag.id,
      beforeAfter: {
        before: { defaultOn: flag.defaultOn, rolloutPct: flag.rolloutPct },
        after: patch,
      },
    });
    return updated;
  }

  /** Fixa (ou remove) o estado da flag para um sujeito específico (usuário de teste). */
  async pinForSubject(
    actor: AdminActor,
    key: string,
    subjectType: 'user' | 'org' | 'plan',
    subjectId: string,
    enabled: boolean,
  ): Promise<FlagAssignmentRow> {
    const flag = await this.repo.findByKey(key);
    if (!flag) throw Errors.notFound('Feature flag');
    const assignment = await this.repo.upsertAssignment({
      flagId: flag.id,
      subjectType,
      subjectId,
      enabled,
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'flag.pin',
      targetType: 'feature_flag',
      targetId: flag.id,
      beforeAfter: { after: { subjectType, subjectId, enabled } },
    });
    return assignment;
  }

  /** Avaliação para um sujeito (ex.: um criador vendo o próprio painel). */
  async isEnabled(key: string, subjectId: string): Promise<boolean> {
    const flag = await this.repo.findByKey(key);
    if (!flag) return false;
    const assignment = await this.repo.findAssignment(flag.id, 'user', subjectId);
    return evaluateFlag(flag, assignment, subjectId, key);
  }
}
