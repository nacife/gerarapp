import type { AiProvider, InteractionDensity } from '@eduforge/ai';
import { AI_CREDITS } from '@eduforge/config';
import { type Difficulty, type InteractionType, validateInteraction } from '@eduforge/schemas';

const MAX_RETRIES = 2;

export interface GenBlock {
  id: string;
  kind: string;
  contentMd: string;
}

export interface DraftInteraction {
  contentBlockId: string;
  type: InteractionType;
  payload: unknown;
  difficulty: Difficulty;
  origin: 'ai_generated';
}

export interface GenerateProgress {
  current: string;
  steps: { key: string; label: string; status: 'pending' | 'running' | 'done'; pct: number }[];
  result?: { generated: number; pendingBlockIds: string[] };
}

export interface GenerateRepository {
  /** Blocos do mapa aprovado; null se o mapa não foi aprovado. */
  getApprovedBlocks(projectId: string): Promise<GenBlock[] | null>;
  clearProjectDrafts(projectId: string): Promise<void>;
  saveInteractions(projectId: string, interactions: DraftInteraction[]): Promise<void>;
  debitCredits(userId: string, amount: number, jobId: string): Promise<void>;
  saveJob(
    jobId: string,
    patch: { status?: 'running' | 'succeeded' | 'failed'; progress?: GenerateProgress; error?: string },
  ): Promise<void>;
}

export interface GeneratePorts {
  ai: AiProvider;
  repo: GenerateRepository;
}

export interface GenerateJobData {
  jobId: string;
  projectId: string;
  ownerUserId: string;
  density: InteractionDensity;
  types?: InteractionType[];
}

/**
 * Geração de interações (RF-02 / US-IA-01): por bloco, gera 2–4 interações,
 * valida cada uma (schema + semântica), retenta até 2×; se persistir inválido,
 * a seção fica "pendente" (sem quebrar o fluxo). Debita créditos ao final.
 * Idempotente: limpa os rascunhos do projeto antes de gerar.
 */
export async function runGeneration(
  data: GenerateJobData,
  ports: GeneratePorts,
): Promise<{ generated: number; pendingBlockIds: string[] }> {
  const { ai, repo } = ports;

  const blocks = await repo.getApprovedBlocks(data.projectId);
  if (!blocks) {
    await repo.saveJob(data.jobId, { status: 'failed', error: 'Mapa de Conteúdo não aprovado.' });
    throw new Error('mapa não aprovado');
  }

  const progress: GenerateProgress = {
    current: 'generate',
    steps: [{ key: 'generate', label: 'Gerando interações', status: 'running', pct: 0 }],
  };
  await repo.saveJob(data.jobId, { status: 'running', progress });
  await repo.clearProjectDrafts(data.projectId);

  let generated = 0;
  const pendingBlockIds: string[] = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    const candidates = await ai.generateInteractions({
      block,
      density: data.density,
      types: data.types,
    });

    const valid: DraftInteraction[] = [];
    for (const candidate of candidates) {
      let result = validateInteraction(candidate.payload);
      let attempt = 0;
      while (!result.ok && attempt < MAX_RETRIES) {
        attempt += 1;
        const regen = await ai.regenerateInteraction({ block, type: candidate.type, attempt });
        result = validateInteraction(regen.payload);
      }
      if (result.ok) {
        valid.push({
          contentBlockId: block.id,
          type: candidate.type,
          payload: result.data,
          difficulty: candidate.difficulty,
          origin: 'ai_generated',
        });
      }
    }

    if (valid.length === 0) {
      pendingBlockIds.push(block.id);
    } else {
      await repo.saveInteractions(data.projectId, valid);
      generated += valid.length;
    }

    progress.steps[0].pct = Math.round(((bi + 1) / blocks.length) * 100);
    await repo.saveJob(data.jobId, { progress });
  }

  if (generated > 0) {
    await repo.debitCredits(data.ownerUserId, generated * AI_CREDITS.costPerInteraction, data.jobId);
  }

  progress.steps[0].status = 'done';
  progress.steps[0].pct = 100;
  progress.result = { generated, pendingBlockIds };
  await repo.saveJob(data.jobId, { status: 'succeeded', progress });

  return { generated, pendingBlockIds };
}
