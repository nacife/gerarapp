import type { CreditRepository, LedgerEntry } from './ports';

export class CreditsService {
  constructor(private readonly credits: CreditRepository) {}

  async balance(userId: string): Promise<{ balance: number }> {
    return { balance: await this.credits.balance(userId) };
  }

  ledger(userId: string): Promise<LedgerEntry[]> {
    return this.credits.ledger(userId, 50);
  }
}
