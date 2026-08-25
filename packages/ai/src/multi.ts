import type { AiProvider, AiBlock } from './provider';
import type { InteractionType } from '@eduforge/schemas';
import type {
  StructureContentInput,
  StructureContentOutput,
  GenerateInteractionsInput,
  GeneratedInteraction,
  MemorialInput,
  MemorialOutput,
  TutorAnswerInput,
  TutorAnswerOutput,
  PodcastScriptInput,
  PodcastScriptOutput,
  SynthesizeInput,
  SynthesizeOutput,
  IllustrationInput,
  IllustrationOutput,
} from './provider';

/**
 * MultiProvider: tenta cada provider em ordem até um sucesso.
 * Se todos falharem e `mockFallback` for true, usa o mock (nunca falha).
 * Implementa fallback transparente para todas as operações de IA.
 */
export class MultiProvider implements AiProvider {
  readonly name = 'multi';
  private static readonly DEFAULT_TIMEOUT_MS = 25000;

  constructor(
    private readonly providers: AiProvider[],
    private readonly mockFallback: AiProvider | null = null,
    private readonly timeoutMs: number = MultiProvider.DEFAULT_TIMEOUT_MS,
  ) {}

  private async withTimeout<T>(p: AiProvider, promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Timeout de ${this.timeoutMs}ms excedido no provider '${p.name}'`));
      }, this.timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }

  private async fallback<T>(method: string, fn: (p: AiProvider) => Promise<T>): Promise<T> {
    const errors: string[] = [];
    for (const p of this.providers) {
      const start = Date.now();
      try {
        const res = await this.withTimeout(p, fn(p));
        const duration = Date.now() - start;
        if (duration > 5000) {
          // eslint-disable-next-line no-console
          console.warn(`[AI MultiProvider] ${p.name}.${method} demorou ${duration}ms`);
        }
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${p.name}: ${msg}`);
      }
    }
    // Fallback final
    if (this.mockFallback) {
      try {
        return await fn(this.mockFallback);
      } catch {
        /* último recurso */
      }
    }
    throw new Error(
      `MultiProvider: todos os providers falharam em ${method}. Erros: ${errors.join(' | ')}`,
    );
  }

  async structureContent(i: StructureContentInput) {
    return this.fallback('structureContent', (p) => p.structureContent(i));
  }
  async generateInteractions(i: GenerateInteractionsInput) {
    return this.fallback('generateInteractions', (p) => p.generateInteractions(i));
  }
  async regenerateInteraction(i: { block: AiBlock; type: InteractionType; attempt?: number }) {
    return this.fallback('regenerateInteraction', (p) => p.regenerateInteraction(i));
  }
  async generateMemorial(i: MemorialInput) {
    return this.fallback('generateMemorial', (p) => p.generateMemorial(i));
  }
  async tutorAnswer(i: TutorAnswerInput) {
    return this.fallback('tutorAnswer', (p) => p.tutorAnswer(i));
  }
  async generatePodcastScript(i: PodcastScriptInput) {
    return this.fallback('generatePodcastScript', (p) => p.generatePodcastScript(i));
  }
  async embedTexts(t: string[]) {
    return this.fallback('embedTexts', (p) => p.embedTexts(t));
  }
  async synthesizeSpeech(i: SynthesizeInput) {
    return this.fallback('synthesizeSpeech', (p) => p.synthesizeSpeech(i));
  }
  async generateIllustration(i: IllustrationInput) {
    return this.fallback('generateIllustration', (p) => p.generateIllustration(i));
  }
}
