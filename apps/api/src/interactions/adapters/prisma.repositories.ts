import { Prisma, prisma } from '@eduforge/db';
import type { Difficulty, InteractionType } from '@eduforge/schemas';
import type {
  CreditRepository,
  InteractionRecord,
  InteractionRepository,
  LedgerEntry,
} from '../ports';

function mapInteraction(row: {
  id: string;
  projectId: string;
  contentBlockId: string | null;
  type: string;
  payload: Prisma.JsonValue;
  difficulty: string;
  origin: string;
  position: number;
}): InteractionRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    contentBlockId: row.contentBlockId,
    type: row.type as InteractionType,
    payload: row.payload,
    difficulty: row.difficulty as Difficulty,
    origin: row.origin,
    position: row.position,
  };
}

export class PrismaInteractionRepository implements InteractionRepository {
  async listDrafts(projectId: string): Promise<InteractionRecord[]> {
    const rows = await prisma.interaction.findMany({
      where: { projectId, appVersionId: null },
      orderBy: [{ contentBlockId: 'asc' }, { position: 'asc' }],
    });
    return rows.map(mapInteraction);
  }

  async findByIdWithContext(id: string) {
    const row = await prisma.interaction.findUnique({
      where: { id },
      include: {
        project: { select: { ownerUserId: true } },
        contentBlock: { select: { kind: true, contentMd: true } },
      },
    });
    if (!row) return null;
    return {
      ...mapInteraction(row),
      ownerUserId: row.project.ownerUserId,
      blockKind: row.contentBlock?.kind ?? null,
      blockContentMd: row.contentBlock?.contentMd ?? null,
    };
  }

  async updatePayload(
    id: string,
    payload: unknown,
    origin: 'ai_edited' | 'ai_generated',
  ): Promise<InteractionRecord> {
    const row = await prisma.interaction.update({
      where: { id },
      data: { payload: payload as Prisma.InputJsonValue, origin },
    });
    return mapInteraction(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.interaction.delete({ where: { id } });
  }
}

export class PrismaCreditRepository implements CreditRepository {
  async balance(userId: string): Promise<number> {
    const agg = await prisma.aiCreditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    return agg._sum.delta ?? 0;
  }

  async ledger(userId: string, limit: number): Promise<LedgerEntry[]> {
    const rows = await prisma.aiCreditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { delta: true, reason: true, refId: true, createdAt: true },
    });
    return rows.map((r) => ({
      delta: r.delta,
      reason: r.reason,
      refId: r.refId,
      createdAt: r.createdAt,
    }));
  }

  async grant(userId: string, delta: number, reason: 'grant' | 'adjustment'): Promise<void> {
    await prisma.aiCreditLedger.create({ data: { userId, delta, reason } });
  }
}
