import { describe, expect, it } from 'vitest';
import { MockAiProvider } from '@eduforge/ai';
import { runSenseiEmbedding, type BlockToEmbed, type SenseiEmbedRepository } from './pipeline';

class FakeRepo implements SenseiEmbedRepository {
  saved = new Map<string, number[]>();
  constructor(private readonly blocks: BlockToEmbed[]) {}

  async getBlocksToEmbed(): Promise<BlockToEmbed[]> {
    return this.blocks.filter((b) => !this.saved.has(b.id));
  }
  async saveEmbedding(blockId: string, vector: number[]): Promise<void> {
    this.saved.set(blockId, vector);
  }
}

const ai = new MockAiProvider();

describe('runSenseiEmbedding', () => {
  it('embeda todos os blocos pendentes com vetores de 1536 dims', async () => {
    const repo = new FakeRepo([
      { id: 'b1', contentMd: 'A membrana regula as trocas da célula.' },
      { id: 'b2', contentMd: 'O núcleo guarda o material genético.' },
      { id: 'b3', contentMd: 'As mitocôndrias produzem energia.' },
    ]);

    const out = await runSenseiEmbedding({ projectId: 'p1' }, { ai, repo });

    expect(out.embedded).toBe(3);
    expect(repo.saved.size).toBe(3);
    expect(repo.saved.get('b1')).toHaveLength(1536);
  });

  it('é idempotente: segunda execução não re-embeda nada', async () => {
    const repo = new FakeRepo([{ id: 'b1', contentMd: 'Conteúdo.' }]);
    await runSenseiEmbedding({ projectId: 'p1' }, { ai, repo });
    const second = await runSenseiEmbedding({ projectId: 'p1' }, { ai, repo });
    expect(second.embedded).toBe(0);
  });

  it('projeto sem mapa aprovado (sem blocos) termina sem trabalho', async () => {
    const out = await runSenseiEmbedding({ projectId: 'p1' }, { ai, repo: new FakeRepo([]) });
    expect(out.embedded).toBe(0);
  });

  it('lotes maiores que o batch (32) são processados por inteiro', async () => {
    const blocks = Array.from({ length: 70 }, (_, i) => ({ id: `b${i}`, contentMd: `Bloco número ${i} sobre biologia.` }));
    const repo = new FakeRepo(blocks);
    const out = await runSenseiEmbedding({ projectId: 'p1' }, { ai, repo });
    expect(out.embedded).toBe(70);
  });
});
