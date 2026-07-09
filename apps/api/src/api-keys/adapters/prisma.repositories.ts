import { prisma } from '@eduforge/db';
import type { ApiKeyEnvironment } from '../domain/key';
import type {
  ActiveApiKeyAuth,
  ApiKeyProjectRepository,
  ApiKeyRepository,
  ApiKeyRow,
  CreateApiKeyInput,
} from '../ports';

function toRow(k: {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  name: string;
  environment: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): ApiKeyRow {
  return {
    id: k.id,
    ownerUserId: k.ownerUserId,
    projectId: k.projectId,
    name: k.name,
    environment: k.environment as ApiKeyEnvironment,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt,
    revokedAt: k.revokedAt,
    createdAt: k.createdAt,
  };
}

export class PrismaApiKeyRepository implements ApiKeyRepository {
  async create(input: CreateApiKeyInput): Promise<ApiKeyRow> {
    const created = await prisma.apiKey.create({
      data: {
        ownerUserId: input.ownerUserId,
        projectId: input.projectId,
        name: input.name,
        environment: input.environment,
        keyPrefix: input.keyPrefix,
        keyHash: input.keyHash,
        scopes: input.scopes,
      },
    });
    return toRow(created);
  }

  async findActiveByHash(keyHash: string): Promise<ActiveApiKeyAuth | null> {
    const found = await prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      include: { owner: { select: { role: true } } },
    });
    if (!found) return null;
    return {
      id: found.id,
      ownerUserId: found.ownerUserId,
      ownerRole: found.owner.role,
      projectId: found.projectId,
      scopes: found.scopes,
      environment: found.environment as ApiKeyEnvironment,
    };
  }

  async findById(id: string): Promise<ApiKeyRow | null> {
    const found = await prisma.apiKey.findUnique({ where: { id } });
    return found ? toRow(found) : null;
  }

  async listActiveForOwner(ownerUserId: string): Promise<ApiKeyRow[]> {
    const rows = await prisma.apiKey.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRow);
  }

  async touchLastUsed(id: string, at: Date): Promise<void> {
    await prisma.apiKey.update({ where: { id }, data: { lastUsedAt: at } });
  }

  async revoke(id: string, at: Date): Promise<ApiKeyRow | null> {
    try {
      const updated = await prisma.apiKey.update({ where: { id }, data: { revokedAt: at } });
      return toRow(updated);
    } catch {
      return null;
    }
  }
}

export class PrismaApiKeyProjectRepository implements ApiKeyProjectRepository {
  async findByIdForOwner(id: string, ownerUserId: string): Promise<{ id: string } | null> {
    const found = await prisma.project.findFirst({ where: { id, ownerUserId }, select: { id: true } });
    return found;
  }
}
