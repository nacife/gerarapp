import { describe, expect, it } from 'vitest';
import { MockAiProvider } from '@eduforge/ai';
import type { AiBlock, AiProvider, GeneratedInteraction } from '@eduforge/ai';
import { validateInteraction, type InteractionType } from '@eduforge/schemas';
import {
  runGeneration,
  type DraftInteraction,
  type GenBlock,
  type GenerateProgress,
  type GenerateRepository,
} from './pipeline';

class FakeGenerateRepo implements GenerateRepository {
  saved: DraftInteraction[] = [];
  debits: { userId: string; amount: number }[] = [];
  jobPatches: { status?: string; progress?: GenerateProgress; error?: string }[] = [];
  cleared = false;
  constructor(private readonly blocks: GenBlock[] | null) {}
  async getApprovedBlocks(): Promise<GenBlock[] | null> {
    return this.blocks;
  }
  async clearProjectDrafts(): Promise<void> {
    this.cleared = true;
  }
  async saveInteractions(_p: string, interactions: DraftInteraction[]): Promise<void> {
    this.saved.push(...interactions);
  }
  async debitCredits(userId: string, amount: number): Promise<void> {
    this.debits.push({ userId, amount });
  }
  async saveJob(
    _id: string,
    patch: { status?: string; progress?: GenerateProgress; error?: string },
  ): Promise<void> {
    this.jobPatches.push(patch);
  }
}

/** Provider que sempre retorna payload inválido (para testar retry → pendente).
 *  Herda do Mock para não reimplementar os métodos que este teste não usa. */
class AlwaysInvalidAi extends MockAiProvider implements AiProvider {
  override async generateInteractions(): Promise<GeneratedInteraction[]> {
    return [{ type: 'quiz', payload: { type: 'quiz', bad: true }, difficulty: 'medium' }];
  }
  override async regenerateInteraction(input: {
    block: AiBlock;
    type: InteractionType;
    attempt?: number;
  }): Promise<GeneratedInteraction> {
    return { type: input.type, payload: { type: input.type, bad: true }, difficulty: 'medium' };
  }
}

const blocks: GenBlock[] = [
  { id: '11111111-1111-1111-1111-111111111111', kind: 'concept', contentMd: 'A célula.' },
  { id: '22222222-2222-2222-2222-222222222222', kind: 'concept', contentMd: 'A mitose.' },
];
const data = {
  jobId: 'job-1',
  projectId: 'prj-1',
  ownerUserId: 'owner-1',
  density: 'balanced' as const,
};

describe('runGeneration (US-IA-01)', () => {
  it('gera interações válidas por bloco e debita créditos', async () => {
    const repo = new FakeGenerateRepo(blocks);
    const out = await runGeneration(data, { ai: new MockAiProvider(), repo });

    expect(out.generated).toBeGreaterThan(0);
    expect(out.pendingBlockIds).toHaveLength(0);
    expect(repo.cleared).toBe(true); // idempotência
    // Propriedade: nenhum payload inválido persiste.
    for (const it of repo.saved) expect(validateInteraction(it.payload).ok).toBe(true);
    // Densidade "balanced": 2..4 por bloco.
    const perBlock = repo.saved.filter((i) => i.contentBlockId === blocks[0].id).length;
    expect(perBlock).toBeGreaterThanOrEqual(2);
    expect(perBlock).toBeLessThanOrEqual(4);
    // Débito no razão de créditos.
    expect(repo.debits).toHaveLength(1);
    expect(repo.debits[0].amount).toBe(out.generated * 3);
    expect(repo.jobPatches.at(-1)?.status).toBe('succeeded');
  });

  it('payload inválido persistente → seção "pendente", sem quebrar o fluxo', async () => {
    const repo = new FakeGenerateRepo([blocks[0]]);
    const out = await runGeneration(data, { ai: new AlwaysInvalidAi(), repo });

    expect(out.generated).toBe(0);
    expect(out.pendingBlockIds).toEqual([blocks[0].id]);
    expect(repo.saved).toHaveLength(0);
    expect(repo.debits).toHaveLength(0); // nada gerado → nada debitado
    expect(repo.jobPatches.at(-1)?.status).toBe('succeeded'); // fluxo não quebra
  });

  it('mapa não aprovado → job falha', async () => {
    const repo = new FakeGenerateRepo(null);
    await expect(runGeneration(data, { ai: new MockAiProvider(), repo })).rejects.toThrow();
    expect(repo.jobPatches.at(-1)?.status).toBe('failed');
  });
});
