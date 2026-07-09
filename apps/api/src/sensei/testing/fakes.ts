import type { AiProvider, SenseiTone, TutorChunk } from '@eduforge/ai';
import type {
  SenseiConfig,
  SenseiCreditsRepository,
  SenseiEventRepository,
  SenseiProjectRepository,
  SenseiRetrievalRepository,
} from '../ports';

// ─────────── helpers ───────────

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot; // vetores L2-normalizados → dot = cosseno
}

// ─────────── SenseiProjectRepository (fake) ───────────

export class FakeSenseiProjectRepository implements SenseiProjectRepository {
  private configs = new Map<string, SenseiConfig>();
  private owners = new Map<string, string>(); // projectId → ownerUserId
  private enrollments = new Map<string, { projectId: string; learnerId: string }>();

  public slugProjectIdMap: Map<string, string>;

  constructor(slugProjectIdMap: Map<string, string> = new Map()) {
    this.slugProjectIdMap = slugProjectIdMap;
  }

  setOwnedProject(projectId: string, ownerUserId: string): void {
    this.owners.set(projectId, ownerUserId);
  }

  setEnrollment(enrollmentId: string, learnerId: string, projectId: string): void {
    this.enrollments.set(enrollmentId, { projectId, learnerId });
  }

  async getOwnedProject(projectId: string, ownerUserId: string) {
    const owner = this.owners.get(projectId);
    if (owner === ownerUserId) return { id: projectId };
    return null;
  }

  async getSenseiConfig(projectId: string) {
    return this.configs.get(projectId) ?? null;
  }

  async setSenseiConfig(projectId: string, config: SenseiConfig) {
    this.configs.set(projectId, config);
  }

  async getProjectForEnrollment(enrollmentId: string, learnerId: string) {
    const e = this.enrollments.get(enrollmentId);
    if (!e || e.learnerId !== learnerId) return null;
    const ownerUserId = this.owners.get(e.projectId) ?? 'unknown-owner';
    return { projectId: e.projectId, ownerUserId };
  }

  async getPublicBySlug(slug: string) {
    const projectId = this.slugProjectIdMap.get(slug);
    if (!projectId) return null;
    const config = this.configs.get(projectId) ?? { name: 'Sensei', avatar: '🤖', tone: 'formal' as SenseiTone };
    return { config, indexed: true };
  }
}

// ─────────── SenseiRetrievalRepository (fake) ───────────

interface StoredBlock {
  blockId: string;
  contentMd: string;
  sourceRef: unknown;
  vector: number[];
}

export class FakeSenseiRetrievalRepository implements SenseiRetrievalRepository {
  private blocks = new Map<string, StoredBlock[]>();
  private ai: AiProvider;

  constructor(ai: AiProvider) {
    this.ai = ai;
  }

  async setBlocks(
    projectId: string,
    chunks: { blockId: string; contentMd: string; sourceRef: unknown }[],
  ): Promise<void> {
    const texts = chunks.map((c) => c.contentMd);
    const vecs = await this.ai.embedTexts(texts);
    this.blocks.set(
      projectId,
      chunks.map((c, i) => ({ ...c, vector: vecs[i]! })),
    );
  }

  async searchBlocks(projectId: string, vector: number[], limit: number): Promise<TutorChunk[]> {
    const all = this.blocks.get(projectId) ?? [];
    const results: TutorChunk[] = all.map((b) => ({
      blockId: b.blockId,
      contentMd: b.contentMd,
      sourceRef: b.sourceRef,
      similarity: cosineSim(vector, b.vector),
    }));
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  async hasEmbeddings(projectId: string) {
    return (this.blocks.get(projectId)?.length ?? 0) > 0;
  }
}

// ─────────── SenseiCreditsRepository (fake) ───────────

export class FakeSenseiCreditsRepository implements SenseiCreditsRepository {
  private balances = new Map<string, number>();
  public debits: { userId: string; amount: number; refId: string }[] = [];

  setBalance(userId: string, balance: number): void {
    this.balances.set(userId, balance);
  }

  async balance(userId: string) {
    return this.balances.get(userId) ?? 0;
  }

  async debit(userId: string, amount: number, refId: string) {
    this.debits.push({ userId, amount, refId });
    const current = this.balances.get(userId) ?? 0;
    this.balances.set(userId, current - amount);
  }
}

// ─────────── SenseiEventRepository (fake) ───────────

export class FakeSenseiEventRepository implements SenseiEventRepository {
  public events: { enrollmentId: string; detail: unknown }[] = [];

  async recordTutorQuestion(enrollmentId: string, detail: unknown) {
    this.events.push({ enrollmentId, detail });
  }
}
