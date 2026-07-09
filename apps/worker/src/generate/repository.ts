import { Prisma, prisma } from '@eduforge/db';
import type {
  DraftInteraction,
  GenBlock,
  GenerateProgress,
  GenerateRepository,
} from './pipeline';

export class PrismaGenerateRepository implements GenerateRepository {
  async getApprovedBlocks(projectId: string): Promise<GenBlock[] | null> {
    const map = await prisma.contentMap.findFirst({
      where: { projectId, approvedAt: { not: null } },
      orderBy: { revision: 'desc' },
      select: { id: true },
    });
    if (!map) return null;
    const blocks = await prisma.contentBlock.findMany({
      where: { contentMapId: map.id },
      orderBy: { position: 'asc' },
      select: { id: true, kind: true, contentMd: true },
    });
    return blocks.map((b) => ({ id: b.id, kind: b.kind, contentMd: b.contentMd }));
  }

  async clearProjectDrafts(projectId: string): Promise<void> {
    await prisma.interaction.deleteMany({ where: { projectId, appVersionId: null } });
  }

  async saveInteractions(projectId: string, interactions: DraftInteraction[]): Promise<void> {
    await prisma.interaction.createMany({
      data: interactions.map((it, i) => ({
        projectId,
        contentBlockId: it.contentBlockId,
        type: it.type,
        payload: it.payload as Prisma.InputJsonValue,
        difficulty: it.difficulty,
        origin: it.origin,
        position: i,
      })),
    });
  }

  async debitCredits(userId: string, amount: number, jobId: string): Promise<void> {
    await prisma.aiCreditLedger.create({
      data: { userId, delta: -Math.abs(amount), reason: 'interactions', refId: jobId },
    });
  }

  async creditBalance(userId: string): Promise<number> {
    const agg = await prisma.aiCreditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    return agg._sum.delta ?? 0;
  }

  async saveJob(
    jobId: string,
    patch: { status?: 'running' | 'succeeded' | 'failed'; progress?: GenerateProgress; error?: string },
  ): Promise<void> {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: patch.status,
        progress: patch.progress
          ? (patch.progress as unknown as Prisma.InputJsonValue)
          : undefined,
        error: patch.error,
      },
    });
  }
}
