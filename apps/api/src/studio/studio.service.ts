import { createHash } from 'node:crypto';
import { canonicalize } from '@eduforge/schemas';
import { buildPaletteFromBrand } from '@eduforge/ui';
import { Errors } from '../common/errors';
import type { WebhooksService } from '../webhooks/webhooks.service';
import {
  DEFAULT_THEME,
  buildManifest,
  type ThemeData,
} from './domain/manifest';
import type {
  ManifestStorage,
  SecretHasher,
  SenseiEmbedEnqueuer,
  StudioProject,
  StudioRepository,
  VersionSummary,
} from './ports';

export class StudioService {
  constructor(
    private readonly repo: StudioRepository,
    private readonly storage: ManifestStorage,
    private readonly hasher: SecretHasher,
    private readonly runtimeBaseUrl: string,
    private readonly webhooks: WebhooksService,
    private readonly senseiEmbed: SenseiEmbedEnqueuer,
  ) {}

  async getTheme(projectId: string, ownerUserId: string): Promise<ThemeData> {
    await this.owned(projectId, ownerUserId);
    return (await this.repo.getTheme(projectId)) ?? DEFAULT_THEME;
  }

  /** Aplica template/paleta/tipografia/efeitos — NÃO toca conteúdo (US-DSG-01). */
  async setTheme(projectId: string, ownerUserId: string, theme: ThemeData): Promise<ThemeData> {
    await this.owned(projectId, ownerUserId);
    await this.repo.upsertTheme(projectId, theme);
    return theme;
  }

  async paletteFromLogo(projectId: string, ownerUserId: string, brand: string) {
    await this.owned(projectId, ownerUserId);
    const built = buildPaletteFromBrand(brand);
    return { palette: built.colors, adjusted: built.adjusted };
  }

  async setAccess(
    projectId: string,
    ownerUserId: string,
    mode: string,
    password?: string,
  ): Promise<void> {
    await this.owned(projectId, ownerUserId);
    const secret =
      mode === 'password' && password ? await this.hasher.hash(password) : null;
    await this.repo.setAccess(projectId, mode, secret);
  }

  /** Publica uma nova versão com manifesto imutável + hash SHA-512 (US-PUB-01). */
  async publish(
    projectId: string,
    ownerUserId: string,
  ): Promise<{ versionNumber: number; url: string; bundleSha512: string }> {
    const project = await this.owned(projectId, ownerUserId);
    const tree = await this.repo.getApprovedTree(projectId);
    if (!tree) throw Errors.mapNotApproved();

    const theme = (await this.repo.getTheme(projectId)) ?? DEFAULT_THEME;
    const interactions = await this.repo.getDraftInteractions(projectId);
    const version = await this.repo.nextVersion(projectId);
    const publishedAt = new Date().toISOString();

    const manifest = buildManifest({
      slug: project.slug,
      title: project.title,
      version,
      publishedAt,
      accessMode: project.accessMode,
      theme,
      content: tree,
      interactions,
    });

    const canonical = canonicalize(manifest);
    const bundleSha512 = createHash('sha512').update(canonical).digest('hex');
    const manifestS3Key = `apps/${project.slug}/v${version}/manifest.json`;
    await this.storage.put(manifestS3Key, canonical);

    const created = await this.repo.createAppVersion({
      projectId,
      versionNumber: version,
      manifest,
      manifestS3Key,
      bundleSha512,
    });
    await this.repo.setActiveAndPublished(projectId, created.id);

    const result = {
      versionNumber: version,
      url: `${this.runtimeBaseUrl}/${project.slug}`,
      bundleSha512,
    };
    await this.webhooks.dispatch(ownerUserId, projectId, 'app.published', result);
    try {
      await this.senseiEmbed.enqueueEmbed(projectId); // indexa o RAG do Sensei (M10)
    } catch {
      // best-effort: o publish não falha se a fila estiver fora; o tutor avisa "não indexado"
    }
    return result;
  }

  async rollback(
    projectId: string,
    ownerUserId: string,
    versionNumber: number,
  ): Promise<{ versionNumber: number }> {
    await this.owned(projectId, ownerUserId);
    const target = await this.repo.findPublishedVersion(projectId, versionNumber);
    if (!target) throw Errors.notFound('Versão');
    await this.repo.setActive(projectId, target.id);
    await this.webhooks.dispatch(ownerUserId, projectId, 'app.rolled_back', { versionNumber });
    return { versionNumber };
  }

  async versions(projectId: string, ownerUserId: string): Promise<VersionSummary[]> {
    await this.owned(projectId, ownerUserId);
    return this.repo.listVersions(projectId);
  }

  private async owned(projectId: string, ownerUserId: string): Promise<StudioProject> {
    const project = await this.repo.getOwnedProject(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');
    return project;
  }
}
