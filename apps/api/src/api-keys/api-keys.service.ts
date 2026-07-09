import { Errors } from '../common/errors';
import { generateApiKeyValue, hashApiKeyValue, type ApiKeyEnvironment } from './domain/key';
import type { ActiveApiKeyAuth, ApiKeyProjectRepository, ApiKeyRepository, ApiKeyRow } from './ports';

export interface CreateApiKeyRequest {
  name: string;
  environment: ApiKeyEnvironment;
  projectId?: string | null;
  scopes: string[];
}

export interface CreatedApiKey {
  key: ApiKeyRow;
  /** Valor bruto — retornado apenas na criação, nunca mais recuperável (Parte 6.B.1). */
  fullKey: string;
}

export class ApiKeysService {
  constructor(
    private readonly repo: ApiKeyRepository,
    private readonly projects: ApiKeyProjectRepository,
    private readonly pepper: string,
  ) {}

  async create(ownerUserId: string, input: CreateApiKeyRequest): Promise<CreatedApiKey> {
    if (input.projectId) {
      const project = await this.projects.findByIdForOwner(input.projectId, ownerUserId);
      if (!project) throw Errors.notFound('Projeto');
    }

    const { fullKey, keyPrefix } = generateApiKeyValue(input.environment);
    const key = await this.repo.create({
      ownerUserId,
      projectId: input.projectId ?? null,
      name: input.name,
      environment: input.environment,
      keyPrefix,
      keyHash: hashApiKeyValue(fullKey, this.pepper),
      scopes: input.scopes,
    });
    return { key, fullKey };
  }

  list(ownerUserId: string): Promise<ApiKeyRow[]> {
    return this.repo.listActiveForOwner(ownerUserId);
  }

  async revoke(ownerUserId: string, id: string): Promise<ApiKeyRow> {
    const key = await this.repo.findById(id);
    if (!key || key.ownerUserId !== ownerUserId) throw Errors.notFound('Chave de API');
    if (key.revokedAt) return key;
    const revoked = await this.repo.revoke(id, new Date());
    if (!revoked) throw Errors.notFound('Chave de API');
    return revoked;
  }

  /** Admin: revoga qualquer chave, sem checar dono (suporte/segurança — RF-12-like). */
  async adminRevoke(id: string): Promise<ApiKeyRow> {
    const key = await this.repo.findById(id);
    if (!key) throw Errors.notFound('Chave de API');
    if (key.revokedAt) return key;
    const revoked = await this.repo.revoke(id, new Date());
    if (!revoked) throw Errors.notFound('Chave de API');
    return revoked;
  }

  /** Usado pelo ApiKeyAuthGuard: hash, valida revogação, registra uso. */
  async authenticate(rawKey: string): Promise<ActiveApiKeyAuth | null> {
    const found = await this.repo.findActiveByHash(hashApiKeyValue(rawKey, this.pepper));
    if (!found) return null;
    await this.repo.touchLastUsed(found.id, new Date());
    return found;
  }
}
