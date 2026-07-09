import { Prisma, prisma } from '@eduforge/db';
import type { BlockToEmbed, SenseiEmbedRepository } from './pipeline';

export class PrismaSenseiEmbedRepository implements SenseiEmbedRepository {
  async getBlocksToEmbed(projectId: string): Promise<BlockToEmbed[]> {
    // Mesmo critério do publish/geração: o mapa APROVADO de revisão mais alta.
    const map = await prisma.contentMap.findFirst({
      where: { projectId, approvedAt: { not: null } },
      orderBy: { revision: 'desc' },
      select: { id: true },
    });
    if (!map) return [];
    // `embedding` é Unsupported("vector") — o client tipado não filtra por ela.
    return prisma.$queryRaw<BlockToEmbed[]>(Prisma.sql`
      SELECT id, content_md AS "contentMd"
      FROM content_blocks
      WHERE content_map_id = ${map.id}::uuid AND embedding IS NULL
      ORDER BY position ASC
    `);
  }

  async saveEmbedding(blockId: string, vector: number[]): Promise<void> {
    const literal = `[${vector.join(',')}]`;
    await prisma.$executeRaw(Prisma.sql`
      UPDATE content_blocks SET embedding = ${literal}::vector WHERE id = ${blockId}::uuid
    `);
  }
}
