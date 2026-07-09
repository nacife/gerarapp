import { describe, expect, it } from 'vitest';
import type { ContentMapTree } from '@eduforge/schemas';
import { AppError } from '../common/errors';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  InMemoryWebhookDeliveryRepository,
  InMemoryWebhookEndpointRepository,
  InMemoryWebhookEnqueuer,
  InMemoryWebhookProjectRepository,
} from '../webhooks/testing/fakes';
import type { ManifestInteraction, ThemeData } from './domain/manifest';
import { PublicAppService } from './public-app.service';
import { StudioService } from './studio.service';
import type {
  ManifestStorage,
  SecretHasher,
  StudioProject,
  StudioRepository,
  VersionSummary,
} from './ports';

const OWNER = 'owner-1';

const tree: ContentMapTree = {
  chapters: [
    {
      id: 'c1',
      title: 'A Célula',
      confidence: 0.9,
      children: [{ id: 's1', title: 'Membrana', confidence: 0.8, kind: 'concept' }],
    },
  ],
};

class FakeStudioRepo implements StudioRepository {
  theme: ThemeData | null = null;
  interactions: ManifestInteraction[] = [
    { id: 'int-1', contentBlockId: 'b1', type: 'quiz', payload: { q: 1 }, difficulty: 'easy', position: 0 },
  ];
  versions: {
    id: string;
    versionNumber: number;
    manifest: any;
    bundleSha512: string;
    status: string;
  }[] = [];
  activeId: string | null = null;

  constructor(
    private readonly project: StudioProject,
    private readonly approvedTree: ContentMapTree | null,
  ) {}

  async getOwnedProject(id: string, owner: string): Promise<StudioProject | null> {
    return id === this.project.id && owner === OWNER ? this.project : null;
  }
  async getApprovedTree(): Promise<ContentMapTree | null> {
    return this.approvedTree;
  }
  async getTheme(): Promise<ThemeData | null> {
    return this.theme;
  }
  async upsertTheme(_p: string, theme: ThemeData): Promise<void> {
    this.theme = theme;
  }
  async getDraftInteractions(): Promise<ManifestInteraction[]> {
    return this.interactions;
  }
  async nextVersion(): Promise<number> {
    return (this.versions.at(-1)?.versionNumber ?? 0) + 1;
  }
  async createAppVersion(input: {
    versionNumber: number;
    manifest: unknown;
    bundleSha512: string;
  }): Promise<{ id: string; versionNumber: number }> {
    const v = {
      id: `v${input.versionNumber}`,
      versionNumber: input.versionNumber,
      manifest: input.manifest,
      bundleSha512: input.bundleSha512,
      status: 'published',
    };
    this.versions.push(v);
    return { id: v.id, versionNumber: v.versionNumber };
  }
  async setActiveAndPublished(_p: string, id: string): Promise<void> {
    this.activeId = id;
  }
  async setActive(_p: string, id: string): Promise<void> {
    this.activeId = id;
  }
  async listVersions(): Promise<VersionSummary[]> {
    return this.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      bundleSha512: v.bundleSha512,
      publishedAt: new Date(),
      active: v.id === this.activeId,
    }));
  }
  async findPublishedVersion(_p: string, n: number): Promise<{ id: string } | null> {
    const v = this.versions.find((x) => x.versionNumber === n && x.status === 'published');
    return v ? { id: v.id } : null;
  }
  async setAccess(_p: string, mode: string, secret: string | null): Promise<void> {
    this.project.accessMode = mode as StudioProject['accessMode'];
    this.project.accessSecret = secret;
  }
  async getActiveManifestBySlug(slug: string) {
    if (slug !== this.project.slug) return null;
    const active = this.versions.find((v) => v.id === this.activeId);
    if (!active) return null;
    return {
      manifest: active.manifest,
      accessMode: this.project.accessMode,
      accessSecret: this.project.accessSecret,
    };
  }
}

const storage: ManifestStorage = { put: async () => {} };
const hasher: SecretHasher = {
  hash: async (s) => `h:${s}`,
  verify: async (h, s) => h === `h:${s}`,
};

function build(approvedTree: ContentMapTree | null = tree) {
  const project: StudioProject = {
    id: 'p1',
    slug: 'biologia-viva',
    title: 'Biologia Viva',
    accessMode: 'public',
    accessSecret: null,
  };
  const repo = new FakeStudioRepo(project, approvedTree);
  const webhookEndpoints = new InMemoryWebhookEndpointRepository();
  const webhookDeliveries = new InMemoryWebhookDeliveryRepository();
  const webhooks = new WebhooksService(
    webhookEndpoints,
    webhookDeliveries,
    new InMemoryWebhookProjectRepository(),
    new InMemoryWebhookEnqueuer(),
    'test-encryption-key-32-chars-ok',
  );
  const senseiEnqueues: string[] = [];
  const studio = new StudioService(repo, storage, hasher, 'http://localhost:5173', webhooks, {
    enqueueEmbed: async (projectId) => {
      senseiEnqueues.push(projectId);
    },
  });
  const publicApp = new PublicAppService(repo, hasher);
  return { studio, publicApp, repo, webhooks, webhookEndpoints, webhookDeliveries, senseiEnqueues };
}

async function err(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('esperava AppError');
}

describe('StudioService — publicação (US-PUB-01)', () => {
  it('publica versão 1 com manifesto imutável + SHA-512', async () => {
    const { studio, repo } = build();
    const res = await studio.publish('p1', OWNER);
    expect(res.versionNumber).toBe(1);
    expect(res.url).toBe('http://localhost:5173/biologia-viva');
    expect(res.bundleSha512).toMatch(/^[a-f0-9]{128}$/); // SHA-512 hex
    expect(repo.versions[0].manifest.version).toBe(1);
    expect(repo.activeId).toBe('v1');
  });

  it('nova publicação cria v2; rollback volta para v1', async () => {
    const { studio, repo } = build();
    await studio.publish('p1', OWNER);
    await studio.publish('p1', OWNER);
    expect(repo.activeId).toBe('v2');
    await studio.rollback('p1', OWNER, 1);
    expect(repo.activeId).toBe('v1');
  });

  it('publicar sem mapa aprovado → 409', async () => {
    const { studio } = build(null);
    const e = await err(() => studio.publish('p1', OWNER));
    expect(e.slug).toBe('map-not-approved');
  });

  it('publish dispara o webhook app.published', async () => {
    const { studio, webhookEndpoints, webhookDeliveries } = build();
    await webhookEndpoints.create({
      ownerUserId: OWNER,
      projectId: null,
      url: 'https://example.com/hook',
      events: ['app.published'],
      secretSealed: { iv: 'x', tag: 'y', data: 'z' },
    });

    await studio.publish('p1', OWNER);

    expect(webhookDeliveries.rows).toHaveLength(1);
    expect(webhookDeliveries.rows[0]?.eventType).toBe('app.published');
  });

  it('publish enfileira a indexação do Sensei (fila sensei-embed)', async () => {
    const { studio, senseiEnqueues } = build();
    await studio.publish('p1', OWNER);
    expect(senseiEnqueues).toEqual(['p1']);
  });

  it('rollback dispara o webhook app.rolled_back', async () => {
    const { studio, webhookEndpoints, webhookDeliveries } = build();
    await webhookEndpoints.create({
      ownerUserId: OWNER,
      projectId: null,
      url: 'https://example.com/hook',
      events: ['app.rolled_back'],
      secretSealed: { iv: 'x', tag: 'y', data: 'z' },
    });
    await studio.publish('p1', OWNER);
    await studio.publish('p1', OWNER);

    await studio.rollback('p1', OWNER, 1);

    expect(webhookDeliveries.rows).toHaveLength(1);
    expect(webhookDeliveries.rows[0]?.eventType).toBe('app.rolled_back');
  });
});

describe('StudioService — trocar template preserva conteúdo (US-DSG-01)', () => {
  it('mudar de template não altera conteúdo nem interações', async () => {
    const { studio, repo } = build();
    await studio.publish('p1', OWNER); // v1, tema default (modern)
    await studio.setTheme('p1', OWNER, {
      templateKey: 'futurist',
      palette: { light: {}, dark: {} },
      typography: {},
      effects: {},
    });
    await studio.publish('p1', OWNER); // v2, tema futurist

    const v1 = repo.versions[0].manifest;
    const v2 = repo.versions[1].manifest;
    expect(v1.theme.template).toBe('modern');
    expect(v2.theme.template).toBe('futurist');
    expect(v2.content).toEqual(v1.content); // conteúdo idêntico
    expect(v2.interactions).toEqual(v1.interactions); // interações idênticas
  });
});

describe('Acesso por senha (US-PUB-01)', () => {
  it('app com senha não entrega manifesto sem a senha', async () => {
    const { studio, publicApp } = build();
    await studio.publish('p1', OWNER);
    await studio.setAccess('p1', OWNER, 'password', 'segredo123');

    const e = await err(() => publicApp.getManifest('biologia-viva'));
    expect(e.slug).toBe('app-locked');

    const manifest = await publicApp.getManifest('biologia-viva', 'segredo123');
    expect((manifest as { slug: string }).slug).toBe('biologia-viva');
  });

  it('app público entrega o manifesto', async () => {
    const { studio, publicApp } = build();
    await studio.publish('p1', OWNER);
    const manifest = await publicApp.getManifest('biologia-viva');
    expect((manifest as { version: number }).version).toBe(1);
  });
});

describe('paletteFromLogo (US-DSG-01)', () => {
  it('deriva paleta com claro e escuro', async () => {
    const { studio } = build();
    const res = await studio.paletteFromLogo('p1', OWNER, '#0ea5e9');
    expect(res.palette.light.primary).toBe('#0ea5e9');
    expect(res.palette.dark).toBeDefined();
    expect(Array.isArray(res.adjusted)).toBe(true);
  });
});
