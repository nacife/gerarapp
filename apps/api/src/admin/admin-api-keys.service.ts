import type { ApiKeysService } from '../api-keys/api-keys.service';
import type { ApiKeyRow } from '../api-keys/ports';
import type { AuditService } from './audit.service';
import type { AdminActor } from './admin-users.service';

/** Ações de suporte/segurança sobre chaves de API — audita via AuditService (RF-12-like). */
export class AdminApiKeysService {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly audit: AuditService,
  ) {}

  async revoke(actor: AdminActor, id: string): Promise<ApiKeyRow> {
    const revoked = await this.apiKeys.adminRevoke(id);

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'api_key.admin_revoke',
      targetType: 'api_key',
      targetId: id,
      beforeAfter: { after: { revokedAt: revoked.revokedAt } },
    });

    return revoked;
  }
}
