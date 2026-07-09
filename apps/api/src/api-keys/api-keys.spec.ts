import { describe, expect, it } from 'vitest';
import { ApiKeysService } from './api-keys.service';
import { InMemoryApiKeyProjectRepository, InMemoryApiKeyRepository } from './testing/fakes';

const OWNER = 'owner-1';
const OTHER_OWNER = 'owner-2';
const PEPPER = 'test-pepper';

function buildService() {
  const repo = new InMemoryApiKeyRepository();
  const projects = new InMemoryApiKeyProjectRepository();
  const service = new ApiKeysService(repo, projects, PEPPER);
  return { repo, projects, service };
}

describe('ApiKeysService.create', () => {
  it('cria a chave e devolve o valor bruto uma única vez', async () => {
    const { service } = buildService();
    const { key, fullKey } = await service.create(OWNER, {
      name: 'CI pipeline',
      environment: 'live',
      scopes: ['projects:read'],
    });
    expect(fullKey.startsWith('efk_live_')).toBe(true);
    expect(key.keyPrefix.length).toBeGreaterThan(0);
    expect(key.ownerUserId).toBe(OWNER);
  });

  it('rejeita escopar a um projeto que não pertence ao dono', async () => {
    const { service, projects } = buildService();
    projects.ownedProjectIds.set('proj-1', OTHER_OWNER);
    await expect(
      service.create(OWNER, { name: 'x', environment: 'live', projectId: 'proj-1', scopes: ['content:read'] }),
    ).rejects.toThrow();
  });

  it('aceita quando o projeto pertence ao dono', async () => {
    const { service, projects } = buildService();
    projects.ownedProjectIds.set('proj-1', OWNER);
    const { key } = await service.create(OWNER, {
      name: 'x',
      environment: 'test',
      projectId: 'proj-1',
      scopes: ['content:read'],
    });
    expect(key.projectId).toBe('proj-1');
  });
});

describe('ApiKeysService.authenticate', () => {
  it('autentica com a chave bruta recém-criada', async () => {
    const { service } = buildService();
    const { fullKey } = await service.create(OWNER, {
      name: 'x',
      environment: 'live',
      scopes: ['projects:read', 'publish'],
    });
    const auth = await service.authenticate(fullKey);
    expect(auth?.ownerUserId).toBe(OWNER);
    expect(auth?.scopes).toEqual(['projects:read', 'publish']);
  });

  it('rejeita chave inexistente', async () => {
    const { service } = buildService();
    expect(await service.authenticate('efk_live_nao-existe')).toBeNull();
  });

  it('rejeita chave revogada', async () => {
    const { service } = buildService();
    const { key, fullKey } = await service.create(OWNER, { name: 'x', environment: 'live', scopes: ['publish'] });
    await service.revoke(OWNER, key.id);
    expect(await service.authenticate(fullKey)).toBeNull();
  });

  it('marca lastUsedAt no repositório após autenticar', async () => {
    const { service, repo } = buildService();
    const { key, fullKey } = await service.create(OWNER, { name: 'x', environment: 'live', scopes: ['publish'] });
    expect((await repo.findById(key.id))?.lastUsedAt).toBeNull();
    await service.authenticate(fullKey);
    expect((await repo.findById(key.id))?.lastUsedAt).not.toBeNull();
  });
});

describe('ApiKeysService.revoke', () => {
  it('dono consegue revogar a própria chave', async () => {
    const { service } = buildService();
    const { key } = await service.create(OWNER, { name: 'x', environment: 'live', scopes: ['publish'] });
    const revoked = await service.revoke(OWNER, key.id);
    expect(revoked.revokedAt).not.toBeNull();
  });

  it('não deixa revogar chave de outro dono', async () => {
    const { service } = buildService();
    const { key } = await service.create(OTHER_OWNER, { name: 'x', environment: 'live', scopes: ['publish'] });
    await expect(service.revoke(OWNER, key.id)).rejects.toThrow();
  });

  it('revogar já-revogada é idempotente', async () => {
    const { service } = buildService();
    const { key } = await service.create(OWNER, { name: 'x', environment: 'live', scopes: ['publish'] });
    await service.revoke(OWNER, key.id);
    const second = await service.revoke(OWNER, key.id);
    expect(second.revokedAt).not.toBeNull();
  });
});

describe('ApiKeysService.adminRevoke', () => {
  it('revoga independentemente do dono', async () => {
    const { service } = buildService();
    const { key } = await service.create(OWNER, { name: 'x', environment: 'live', scopes: ['publish'] });
    const revoked = await service.adminRevoke(key.id);
    expect(revoked.revokedAt).not.toBeNull();
  });

  it('lança not-found para chave inexistente', async () => {
    const { service } = buildService();
    await expect(service.adminRevoke('does-not-exist')).rejects.toThrow();
  });
});

describe('ApiKeysService.list', () => {
  it('lista só as chaves do dono', async () => {
    const { service } = buildService();
    await service.create(OWNER, { name: 'a', environment: 'live', scopes: ['publish'] });
    await service.create(OTHER_OWNER, { name: 'b', environment: 'live', scopes: ['publish'] });
    const list = await service.list(OWNER);
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('a');
  });
});
