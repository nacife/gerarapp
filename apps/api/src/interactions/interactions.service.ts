import type { AiProvider, InteractionDensity } from '@eduforge/ai';
import { type InteractionType, validateInteraction } from '@eduforge/schemas';
import { Errors } from '../common/errors';
import type {
  ContentMapRepository,
  JobRepository,
  ProjectRepository,
} from '../projects/ports';
import type {
  CreditRepository,
  GenerateEnqueuer,
  InteractionRecord,
  InteractionRepository,
} from './ports';

const MAX_RETRIES = 2;

export class InteractionsService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly maps: ContentMapRepository,
    private readonly jobs: JobRepository,
    private readonly interactions: InteractionRepository,
    private readonly credits: CreditRepository,
    private readonly enqueuer: GenerateEnqueuer,
    private readonly ai: AiProvider,
  ) {}

  /** Enfileira a geração de interações (US-IA-01). */
  async generate(
    projectId: string,
    ownerUserId: string,
    input: { density: InteractionDensity; types?: InteractionType[] },
  ): Promise<{ jobId: string }> {
    const project = await this.projects.findByIdForOwner(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');

    const map = await this.maps.latestForProject(projectId);
    if (!map || !map.approvedAt) throw Errors.mapNotApproved();

    // Créditos insuficientes → NENHUM job é enfileirado (Gherkin).
    const balance = await this.credits.balance(ownerUserId);
    if (balance <= 0) throw Errors.insufficientCredits(balance);

    const job = await this.jobs.create({
      type: 'generate',
      projectId,
      progress: {
        current: 'generate',
        steps: [{ key: 'generate', label: 'Gerando interações', status: 'pending', pct: 0 }],
      },
    });
    await this.enqueuer.enqueueGenerate({
      jobId: job.id,
      projectId,
      ownerUserId,
      density: input.density,
      types: input.types,
    });
    return { jobId: job.id };
  }

  async list(projectId: string, ownerUserId: string): Promise<InteractionRecord[]> {
    const project = await this.projects.findByIdForOwner(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');
    return this.interactions.listDrafts(projectId);
  }

  /** Edita (valida schema + semântica; origin → ai_edited). */
  async edit(id: string, ownerUserId: string, payload: unknown): Promise<InteractionRecord> {
    const it = await this.interactions.findByIdWithContext(id);
    if (!it || it.ownerUserId !== ownerUserId) throw Errors.notFound('Interação');
    const result = validateInteraction(payload);
    if (!result.ok) throw Errors.invalidInteraction(result.errors);
    return this.interactions.updatePayload(id, result.data, 'ai_edited');
  }

  async remove(id: string, ownerUserId: string): Promise<void> {
    const it = await this.interactions.findByIdWithContext(id);
    if (!it || it.ownerUserId !== ownerUserId) throw Errors.notFound('Interação');
    await this.interactions.delete(id);
  }

  /** Regenera apenas esta interação (origin → ai_generated). */
  async regenerate(id: string, ownerUserId: string): Promise<InteractionRecord> {
    const it = await this.interactions.findByIdWithContext(id);
    if (!it || it.ownerUserId !== ownerUserId) throw Errors.notFound('Interação');

    const block = {
      id: it.contentBlockId ?? id,
      kind: it.blockKind ?? 'concept',
      contentMd: it.blockContentMd ?? '',
    };
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const gen = await this.ai.regenerateInteraction({ block, type: it.type, attempt });
      const result = validateInteraction(gen.payload);
      if (result.ok) return this.interactions.updatePayload(id, result.data, 'ai_generated');
    }
    throw Errors.invalidInteraction(['não foi possível regenerar uma interação válida.']);
  }
}
