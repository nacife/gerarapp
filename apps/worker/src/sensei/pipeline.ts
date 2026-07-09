import type { AiProvider } from '@eduforge/ai';

export interface SenseiEmbedJobData {
  projectId: string;
}

export interface BlockToEmbed {
  id: string;
  contentMd: string;
}

export interface SenseiEmbedRepository {
  /** Blocos do mapa APROVADO mais recente do projeto ainda sem embedding. */
  getBlocksToEmbed(projectId: string): Promise<BlockToEmbed[]>;
  saveEmbedding(blockId: string, vector: number[]): Promise<void>;
}

export interface SenseiEmbedPorts {
  ai: Pick<AiProvider, 'embedTexts'>;
  repo: SenseiEmbedRepository;
}

const BATCH_SIZE = 32;

/**
 * Indexa os blocos do mapa aprovado para o RAG do Sensei (RF-06.1). Idempotente:
 * só embeda blocos com `embedding IS NULL` — republicar sem mudar o conteúdo
 * não recomputa nada. Disparado pelo publish (fire-and-forget).
 */
export async function runSenseiEmbedding(
  data: SenseiEmbedJobData,
  ports: SenseiEmbedPorts,
): Promise<{ embedded: number }> {
  const blocks = await ports.repo.getBlocksToEmbed(data.projectId);
  let embedded = 0;

  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE);
    const vectors = await ports.ai.embedTexts(batch.map((b) => b.contentMd));
    for (const [j, block] of batch.entries()) {
      await ports.repo.saveEmbedding(block.id, vectors[j]!);
      embedded += 1;
    }
  }

  return { embedded };
}
