import type { Difficulty, InteractionType } from '@eduforge/schemas';

export interface InteractionRecord {
  id: string;
  projectId: string;
  contentBlockId: string | null;
  type: InteractionType;
  payload: unknown;
  difficulty: Difficulty;
  origin: string;
  position: number;
}

export interface InteractionRepository {
  listDrafts(projectId: string): Promise<InteractionRecord[]>;
  findByIdWithContext(id: string): Promise<
    | (InteractionRecord & {
        ownerUserId: string;
        blockKind: string | null;
        blockContentMd: string | null;
      })
    | null
  >;
  updatePayload(
    id: string,
    payload: unknown,
    origin: 'ai_edited' | 'ai_generated',
  ): Promise<InteractionRecord>;
  delete(id: string): Promise<void>;
}

export interface LedgerEntry {
  delta: number;
  reason: string;
  refId: string | null;
  createdAt: Date;
}

export interface CreditRepository {
  balance(userId: string): Promise<number>;
  ledger(userId: string, limit: number): Promise<LedgerEntry[]>;
  /** Concessão/ajuste administrativo de créditos (RF-12). */
  grant(userId: string, delta: number, reason: 'grant' | 'adjustment'): Promise<void>;
}

export interface GenerateEnqueuer {
  enqueueGenerate(input: {
    jobId: string;
    projectId: string;
    ownerUserId: string;
    density: 'light' | 'balanced' | 'intensive';
    types?: InteractionType[];
  }): Promise<void>;
}
