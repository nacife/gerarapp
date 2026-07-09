import { randomUUID } from 'node:crypto';
import type { ActiveApiKeyAuth, ApiKeyProjectRepository, ApiKeyRepository, ApiKeyRow, CreateApiKeyInput } from '../ports';

interface StoredKey extends ApiKeyRow {
  keyHash: string;
  ownerRole: string;
}

export class InMemoryApiKeyRepository implements ApiKeyRepository {
  rows: StoredKey[] = [];

  async create(input: CreateApiKeyInput): Promise<ApiKeyRow> {
    const row: StoredKey = {
      id: randomUUID(),
      ownerUserId: input.ownerUserId,
      projectId: input.projectId,
      name: input.name,
      environment: input.environment,
      keyPrefix: input.keyPrefix,
      keyHash: input.keyHash,
      scopes: input.scopes,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      ownerRole: 'creator',
    };
    this.rows.push(row);
    return row;
  }

  async findActiveByHash(keyHash: string): Promise<ActiveApiKeyAuth | null> {
    const found = this.rows.find((r) => r.keyHash === keyHash && !r.revokedAt);
    if (!found) return null;
    return {
      id: found.id,
      ownerUserId: found.ownerUserId,
      ownerRole: found.ownerRole,
      projectId: found.projectId,
      scopes: found.scopes,
      environment: found.environment,
    };
  }

  async findById(id: string): Promise<ApiKeyRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async listActiveForOwner(ownerUserId: string): Promise<ApiKeyRow[]> {
    return this.rows.filter((r) => r.ownerUserId === ownerUserId);
  }

  async touchLastUsed(id: string, at: Date): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.lastUsedAt = at;
  }

  async revoke(id: string, at: Date): Promise<ApiKeyRow | null> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return null;
    row.revokedAt = at;
    return row;
  }
}

export class InMemoryApiKeyProjectRepository implements ApiKeyProjectRepository {
  ownedProjectIds = new Map<string, string>(); // projectId -> ownerUserId

  async findByIdForOwner(id: string, ownerUserId: string): Promise<{ id: string } | null> {
    return this.ownedProjectIds.get(id) === ownerUserId ? { id } : null;
  }
}
