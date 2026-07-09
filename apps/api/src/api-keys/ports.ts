import type { ApiKeyEnvironment } from './domain/key';

export interface ApiKeyRow {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  name: string;
  environment: ApiKeyEnvironment;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ActiveApiKeyAuth {
  id: string;
  ownerUserId: string;
  ownerRole: string;
  projectId: string | null;
  scopes: string[];
  environment: ApiKeyEnvironment;
}

export interface CreateApiKeyInput {
  ownerUserId: string;
  projectId: string | null;
  name: string;
  environment: ApiKeyEnvironment;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
}

export interface ApiKeyRepository {
  create(input: CreateApiKeyInput): Promise<ApiKeyRow>;
  findActiveByHash(keyHash: string): Promise<ActiveApiKeyAuth | null>;
  findById(id: string): Promise<ApiKeyRow | null>;
  listActiveForOwner(ownerUserId: string): Promise<ApiKeyRow[]>;
  touchLastUsed(id: string, at: Date): Promise<void>;
  revoke(id: string, at: Date): Promise<ApiKeyRow | null>;
}

/** Porta mínima para validar que um projeto pertence ao dono antes de escopar uma chave. */
export interface ApiKeyProjectRepository {
  findByIdForOwner(id: string, ownerUserId: string): Promise<{ id: string } | null>;
}
