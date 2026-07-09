import type { AiProvider } from '@eduforge/ai';
import { AI_CREDITS } from '@eduforge/config';
import { Errors } from '../common/errors';
import type { MediaCreditsRepository, MediaJobEnqueuer, MediaRepository, MediaStorage } from './ports';

export interface MediaItem {
  id: string;
  kind: string;
  meta: unknown;
  url: string;
  createdAt: Date;
}

export class MediaService {
  constructor(
    private readonly repo: MediaRepository,
    private readonly storage: MediaStorage,
    private readonly credits: MediaCreditsRepository,
    private readonly enqueuer: MediaJobEnqueuer,
    private readonly ai: AiProvider,
  ) {}

  /** Gera podcast para um capítulo (RF-06.5). */
  async generatePodcast(projectId: string, ownerUserId: string, chapterId: string) {
    const project = await this.repo.getOwnedProject(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');

    const chapter = await this.repo.getChapter(projectId, chapterId);
    if (!chapter) throw Errors.notFound('Capítulo');

    const jobId = await this.repo.createJob(projectId, chapterId);
    await this.enqueuer.enqueueTts({ jobId, projectId, chapterId, appTitle: project.title });

    return { jobId };
  }

  /** Gera ilustração para um capítulo (M10 "imagens IA"). Síncrono (mock). */
  async generateIllustration(projectId: string, ownerUserId: string, chapterId: string) {
    const project = await this.repo.getOwnedProject(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');

    const chapter = await this.repo.getChapter(projectId, chapterId);
    if (!chapter) throw Errors.notFound('Capítulo');

    // Saldo do criador.
    const balance = await this.credits.balance(ownerUserId);
    if (balance < AI_CREDITS.costIllustration) {
      throw Errors.insufficientCredits(balance, AI_CREDITS.costIllustration);
    }

    // Paleta do tema.
    const palette = await this.repo.getThemePalette(projectId);
    if (!palette) throw Errors.notFound('Tema');

    // Extrai título do capítulo do markdown.
    const titleMatch = /^#{1,3}\s+(.+)$/m.exec(chapter.contentMd);
    const chapterTitle = titleMatch ? titleMatch[1].trim() : 'Capítulo';

    // Seed text = primeiras linhas do conteúdo do capítulo (sem heading).
    const seedText = chapter.contentMd.replace(/^#{1,3}\s+.+$/gm, '').trim().slice(0, 500);

    // Gera ilustração.
    const illustration = await this.ai.generateIllustration({
      chapterTitle,
      palette,
      seedText,
    });

    // Upload SVG para S3.
    const s3Key = `media/illustrations/${projectId}/${chapterId}.svg`;
    await this.storage.put(s3Key, Buffer.from(illustration.svg, 'utf-8'), 'image/svg+xml');

    // Upsert media_asset (substitui ilustração anterior do mesmo capítulo).
    const asset = await this.repo.upsertMediaAsset({
      projectId,
      s3Key,
      kind: 'ai_generated',
      meta: {
        chapterId,
        alt: illustration.alt,
        prompt: illustration.prompt,
      },
    });

    // Debita 2 créditos.
    await this.credits.debit(ownerUserId, AI_CREDITS.costIllustration, 'image', asset.id);

    return {
      mediaAssetId: asset.id,
      alt: illustration.alt,
    };
  }

  /** Lista mídia do projeto (dono). */
  async listProjectMedia(projectId: string, ownerUserId: string): Promise<MediaItem[]> {
    const project = await this.repo.getOwnedProject(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');

    const rows = await this.repo.listByProject(projectId);
    return Promise.all(rows.map(async (r) => ({ ...r, url: await this.storage.presignGet(r.s3Key) })));
  }

  /** Lista mídia pública (app publicado). */
  async listPublicMedia(slug: string): Promise<MediaItem[]> {
    const rows = await this.repo.listByPublishedSlug(slug);
    if (rows.length === 0) {
      const exists = await this.repo.isPublished(slug);
      if (!exists) throw Errors.notFound('App');
    }
    return Promise.all(rows.map(async (r) => ({ ...r, url: await this.storage.presignGet(r.s3Key) })));
  }
}
