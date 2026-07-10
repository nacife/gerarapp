import { Prisma, prisma } from '@eduforge/db';
import type { MediaAssetRow, MediaCreditsRepository, MediaRepository } from '../ports';

export class PrismaMediaRepository implements MediaRepository {
  async listByProject(projectId: string): Promise<MediaAssetRow[]> {
    return prisma.mediaAsset.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, meta: true, s3Key: true, createdAt: true },
    });
  }

  async listByPublishedSlug(slug: string): Promise<MediaAssetRow[]> {
    return prisma.mediaAsset.findMany({
      where: { project: { slug, activeAppVersionId: { not: null } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, meta: true, s3Key: true, createdAt: true },
    });
  }

  async getOwnedProject(projectId: string, ownerUserId: string) {
    return prisma.project.findFirst({
      where: { id: projectId, ownerUserId },
      select: { id: true, title: true },
    });
  }

  async getChapter(projectId: string, chapterId: string) {
    const map = await prisma.contentMap.findFirst({
      where: { projectId, approvedAt: { not: null } },
      orderBy: { revision: 'desc' },
      select: { id: true },
    });
    if (!map) return null;

    // Tenta como UUID de ContentBlock primeiro
    const block = await prisma.contentBlock.findFirst({
      where: { id: chapterId, contentMapId: map.id },
      select: { id: true, contentMd: true, parentId: true },
    });
    if (block) return block;

    // Fallback: tenta como tree node ID (ex: "c1") — procura blocos filhos
    // e retorna o primeiro section block como representante do capítulo
    const childBlock = await prisma.contentBlock.findFirst({
      where: { parentId: chapterId, contentMapId: map.id },
      orderBy: { position: 'asc' },
      select: { id: true, contentMd: true },
    });
    return childBlock;
  }

  async createJob(projectId: string, chapterId: string): Promise<string> {
    const job = await prisma.job.create({
      data: { type: 'tts', status: 'queued', projectId, refId: chapterId },
      select: { id: true },
    });
    return job.id;
  }

  async isPublished(slug: string): Promise<boolean> {
    const p = await prisma.project.findFirst({
      where: { slug, activeAppVersionId: { not: null } },
      select: { id: true },
    });
    return p !== null;
  }

  async getThemePalette(projectId: string): Promise<Record<string, string> | null> {
    const theme = await prisma.theme.findFirst({
      where: { projectId },
      select: { palette: true },
    });
    if (!theme?.palette) return null;
    const p = theme.palette as Record<string, unknown>;
    // Palette JSON: { light: {...}, dark: {...} } — retorna o light para a ilustração.
    if (p.light && typeof p.light === 'object') return p.light as Record<string, string>;
    // Fallback: retorna o objeto inteiro se não houver separação light/dark.
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  }

  async upsertMediaAsset(input: {
    projectId: string;
    s3Key: string;
    kind: string;
    meta: unknown;
  }): Promise<{ id: string }> {
    const meta = input.meta as Record<string, unknown>;
    const chapterId = meta.chapterId as string | undefined;

    // Busca existente por projectId + chapterId (dentro do JSON meta).
    if (chapterId) {
      const existing = await prisma.mediaAsset.findFirst({
        where: { projectId: input.projectId, kind: 'ai_generated' },
        select: { id: true, meta: true },
      });
      if (existing) {
        const found = existing.meta as Record<string, unknown> | null;
        if (found?.chapterId === chapterId) {
          // Sobrescreve.
          await prisma.mediaAsset.update({
            where: { id: existing.id },
            data: {
              s3Key: input.s3Key,
              meta: input.meta as Prisma.InputJsonValue,
            },
          });
          return { id: existing.id };
        }
      }
    }

    return prisma.mediaAsset.create({
      data: {
        projectId: input.projectId,
        s3Key: input.s3Key,
        kind: 'ai_generated',
        meta: input.meta as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  }

  async findIllustration(projectId: string, chapterId: string) {
    const assets = await prisma.mediaAsset.findMany({
      where: { projectId, kind: 'ai_generated' },
      select: { id: true, meta: true, s3Key: true },
    });
    for (const a of assets) {
      const m = a.meta as Record<string, unknown> | null;
      if (m?.chapterId === chapterId) return { s3Key: a.s3Key };
    }
    return null;
  }
}

export class PrismaMediaCreditsRepository implements MediaCreditsRepository {
  async balance(userId: string): Promise<number> {
    const agg = await prisma.aiCreditLedger.aggregate({
      where: { userId },
      _sum: { delta: true },
    });
    return agg._sum.delta ?? 0;
  }

  async debit(userId: string, amount: number, reason: string, refId: string): Promise<void> {
    await prisma.aiCreditLedger.create({
      data: { userId, delta: -Math.abs(amount), reason: reason as 'image' | 'tts' | 'tutor', refId },
    });
  }
}
