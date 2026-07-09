import { beforeEach, describe, expect, it } from 'vitest';
import { MockAiProvider } from '@eduforge/ai';
import { buildValidInteraction, type ContentMapTree } from '@eduforge/schemas';
import { AppError } from '../common/errors';
import {
  InMemoryContentMapRepository,
  InMemoryJobRepository,
  InMemoryProjectRepository,
} from '../projects/testing/fakes';
import { InteractionsService } from './interactions.service';
import type {
  CreditRepository,
  GenerateEnqueuer,
  InteractionRecord,
  InteractionRepository,
  LedgerEntry,
} from './ports';

const OWNER = 'owner-1';
const BLOCK = '11111111-1111-1111-1111-111111111111';

class FakeCredits implements CreditRepository {
  private entries: { userId: string; delta: number }[] = [];
  /** Helper de setup do teste (concessão inicial, fora da interface). */
  seedGrant(userId: string, amount: number) {
    this.entries.push({ userId, delta: amount });
  }
  async grant(userId: string, delta: number): Promise<void> {
    this.entries.push({ userId, delta });
  }
  async balance(userId: string): Promise<number> {
    return this.entries.filter((e) => e.userId === userId).reduce((s, e) => s + e.delta, 0);
  }
  async ledger(): Promise<LedgerEntry[]> {
    return [];
  }
}

class FakeInteractions implements InteractionRepository {
  rows: (InteractionRecord & {
    ownerUserId: string;
    blockKind: string | null;
    blockContentMd: string | null;
  })[] = [];
  async listDrafts(projectId: string): Promise<InteractionRecord[]> {
    return this.rows.filter((r) => r.projectId === projectId);
  }
  async findByIdWithContext(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async updatePayload(
    id: string,
    payload: unknown,
    origin: 'ai_edited' | 'ai_generated',
  ): Promise<InteractionRecord> {
    const r = this.rows.find((x) => x.id === id)!;
    r.payload = payload;
    r.origin = origin;
    return r;
  }
  async delete(id: string): Promise<void> {
    this.rows = this.rows.filter((r) => r.id !== id);
  }
}

class FakeEnqueuer implements GenerateEnqueuer {
  enqueued: unknown[] = [];
  async enqueueGenerate(input: unknown): Promise<void> {
    this.enqueued.push(input);
  }
}

const tree: ContentMapTree = {
  chapters: [{ id: 'c1', title: 'Cap', confidence: 0.9, children: [] }],
};

function build() {
  const projects = new InMemoryProjectRepository();
  const maps = new InMemoryContentMapRepository();
  const jobs = new InMemoryJobRepository();
  const interactions = new FakeInteractions();
  const credits = new FakeCredits();
  const enqueuer = new FakeEnqueuer();
  const service = new InteractionsService(
    projects,
    maps,
    jobs,
    interactions,
    credits,
    enqueuer,
    new MockAiProvider(),
  );
  const project = projects.seedProject(OWNER);
  return { service, projects, maps, interactions, credits, enqueuer, project };
}

async function approveMap(maps: InMemoryContentMapRepository, projectId: string) {
  await maps.createRevision({ projectId, tree, structureConfidence: 0.9 });
  await maps.approveLatest(projectId, new Date());
}

async function expectError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('esperava AppError');
}

describe('InteractionsService.generate (US-IA-01)', () => {
  it('créditos insuficientes → 402 e NENHUM job enfileirado', async () => {
    const kit = build();
    await approveMap(kit.maps, kit.project.id);
    // sem grant → saldo 0
    const err = await expectError(() =>
      kit.service.generate(kit.project.id, OWNER, { density: 'balanced' }),
    );
    expect(err.slug).toBe('insufficient-credits');
    expect(kit.enqueuer.enqueued).toHaveLength(0);
  });

  it('mapa não aprovado → 409', async () => {
    const kit = build();
    kit.credits.seedGrant(OWNER, 500);
    const err = await expectError(() =>
      kit.service.generate(kit.project.id, OWNER, { density: 'balanced' }),
    );
    expect(err.slug).toBe('map-not-approved');
  });

  it('com créditos e mapa aprovado → enfileira job', async () => {
    const kit = build();
    kit.credits.seedGrant(OWNER, 500);
    await approveMap(kit.maps, kit.project.id);
    const { jobId } = await kit.service.generate(kit.project.id, OWNER, { density: 'balanced' });
    expect(jobId).toBeTruthy();
    expect(kit.enqueuer.enqueued).toHaveLength(1);
  });
});

describe('InteractionsService — edição e regeneração', () => {
  let kit: ReturnType<typeof build>;
  let interactionId: string;

  beforeEach(() => {
    kit = build();
    interactionId = 'int-1';
    kit.interactions.rows.push({
      id: interactionId,
      projectId: kit.project.id,
      contentBlockId: BLOCK,
      type: 'quiz',
      payload: buildValidInteraction('quiz', BLOCK),
      difficulty: 'medium',
      origin: 'ai_generated',
      position: 0,
      ownerUserId: OWNER,
      blockKind: 'concept',
      blockContentMd: 'A célula.',
    });
  });

  it('editar com payload válido → origin ai_edited', async () => {
    const payload = buildValidInteraction('quiz', BLOCK) as Record<string, unknown>;
    (payload as any).question_md = 'Pergunta editada com detalhes suficientes?';
    const updated = await kit.service.edit(interactionId, OWNER, payload);
    expect(updated.origin).toBe('ai_edited');
  });

  it('editar com payload inválido → 422', async () => {
    const bad = buildValidInteraction('quiz', BLOCK) as any;
    bad.options.forEach((o: any) => (o.correct = false));
    const err = await expectError(() => kit.service.edit(interactionId, OWNER, bad));
    expect(err.slug).toBe('invalid-interaction');
  });

  it('regenerar substitui e marca origin ai_generated', async () => {
    const regen = await kit.service.regenerate(interactionId, OWNER);
    expect(regen.origin).toBe('ai_generated');
  });

  it('outro dono não acessa (multi-tenant)', async () => {
    const err = await expectError(() => kit.service.edit(interactionId, 'intruso', {}));
    expect(err.slug).toBe('not-found');
  });
});
