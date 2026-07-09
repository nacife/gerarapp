import { Prisma, prisma } from '@eduforge/db';
import type { TutorChunk } from '@eduforge/ai';
import type { SenseiConfig, SenseiProjectRepository } from '../ports';
import type { SenseiRetrievalRepository } from '../ports';
import type { SenseiCreditsRepository } from '../ports';
import type { SenseiEventRepository } from '../ports';

// ─────────── SenseiProjectRepository ───────────

export class PrismaSenseiProjectRepository implements SenseiProjectRepository {
  async getOwnedProject(projectId: string, ownerUserId: string): Promise<{ id: string } | null> {
    return prisma.project.findFirst({
      where: { id: projectId, ownerUserId },
      select: { id: true },
    });
  }

  async getSenseiConfig(projectId: string): Promise<SenseiConfig | null> {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: { senseiConfig: true },
    });
    return (p?.senseiConfig as SenseiConfig | null) ?? null;
  }

  async setSenseiConfig(projectId: string, config: SenseiConfig): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: { senseiConfig: config as unknown as Prisma.InputJsonValue },
    });
  }

  async getProjectForEnrollment(
    enrollmentId: string,
    learnerId: string,
  ): Promise<{ projectId: string; ownerUserId: string } | null> {
    const row = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, learnerId },
      select: {
        project: { select: { id: true, ownerUserId: true } },
      },
    });
    if (!row) return null;
    return { projectId: row.project.id, ownerUserId: row.project.ownerUserId };
  }

  async getPublicBySlug(
    slug: string,
  ): Promise<{ config: SenseiConfig; indexed: boolean } | null> {
    const p = await prisma.project.findFirst({
      where: { slug, activeAppVersionId: { not: null } },
      select: { senseiConfig: true, id: true },
    });
    if (!p) return null;

    const config = (p.senseiConfig as SenseiConfig | null) ?? {
      name: 'Sensei',
      avatar: '🤖',
      tone: 'formal',
    };

    // Verifica se há ao menos um embedding para saber se o RAG está funcional.
    const [{ exists }] = await prisma.$queryRaw<[{ exists: boolean }]>(Prisma.sql`
      SELECT EXISTS(
        SELECT 1 FROM content_blocks cb
        JOIN content_maps cm ON cm.id = cb.content_map_id
        WHERE cm.project_id = ${p.id}::uuid AND cm.approved_at IS NOT NULL AND cb.embedding IS NOT NULL
        LIMIT 1
      ) AS "exists"
    `);

    return { config, indexed: exists };
  }
}

// ─────────── SenseiRetrievalRepository ───────────

export class PrismaSenseiRetrievalRepository implements SenseiRetrievalRepository {
  async searchBlocks(projectId: string, vector: number[], limit: number): Promise<TutorChunk[]> {
    const vec = `[${vector.join(',')}]`;
    return prisma.$queryRaw<TutorChunk[]>(Prisma.sql`
      SELECT
        cb.id AS "blockId",
        cb.content_md AS "contentMd",
        cb.source_ref AS "sourceRef",
        1 - (cb.embedding <=> ${vec}::vector) AS similarity
      FROM content_blocks cb
      JOIN content_maps cm ON cm.id = cb.content_map_id
      WHERE cm.project_id = ${projectId}::uuid
        AND cm.approved_at IS NOT NULL
        AND cb.embedding IS NOT NULL
      ORDER BY cb.embedding <=> ${vec}::vector
      LIMIT ${limit}
    `);
  }

  async hasEmbeddings(projectId: string): Promise<boolean> {
    const [{ exists }] = await prisma.$queryRaw<[{ exists: boolean }]>(Prisma.sql`
      SELECT EXISTS(
        SELECT 1 FROM content_blocks cb
        JOIN content_maps cm ON cm.id = cb.content_map_id
        WHERE cm.project_id = ${projectId}::uuid AND cm.approved_at IS NOT NULL AND cb.embedding IS NOT NULL
        LIMIT 1
      ) AS "exists"
    `);
    return exists;
  }
}

// ─────────── SenseiCreditsRepository ───────────

export class PrismaSenseiCreditsRepository implements SenseiCreditsRepository {
  async balance(userId: string): Promise<number> {
    const agg = await prisma.aiCreditLedger.aggregate({
      where: { userId },
      _sum: { delta: true },
    });
    return agg._sum.delta ?? 0;
  }

  async debit(userId: string, amount: number, refId: string): Promise<void> {
    await prisma.aiCreditLedger.create({
      data: { userId, delta: -Math.abs(amount), reason: 'tutor', refId },
    });
  }
}

// ─────────── SenseiEventRepository ───────────

export class PrismaSenseiEventRepository implements SenseiEventRepository {
  async recordTutorQuestion(enrollmentId: string, detail: unknown): Promise<void> {
    await prisma.learningEvent.create({
      data: {
        enrollmentId,
        event: 'tutor_question',
        detail: detail as Prisma.InputJsonValue,
      },
    });
  }
}
