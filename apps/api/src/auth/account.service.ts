import { Errors } from '../common/errors';
import type { Clock } from './domain/clock';
import type {
  AccountDataPort,
  AccountExport,
  DeletionEnqueuer,
  SessionRepository,
  UserRepository,
} from './ports';

/**
 * LGPD (§0.5.7): exportação de dados e exclusão de conta.
 * Exclusão = anonimização assíncrona (enfileirada para o worker).
 */
export class AccountService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly data: AccountDataPort,
    private readonly deletion: DeletionEnqueuer,
    private readonly clock: Clock,
  ) {}

  async exportData(userId: string): Promise<AccountExport> {
    const user = await this.users.findById(userId);
    if (!user) throw Errors.unauthorized();
    return this.data.exportUserData(userId);
  }

  async requestDeletion(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw Errors.unauthorized();
    await this.users.setStatus(userId, 'pending_deletion');
    await this.sessions.revokeAllForUser(userId, this.clock.now());
    await this.deletion.enqueueAnonymizeUser(userId);
  }
}
