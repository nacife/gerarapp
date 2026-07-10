import type { AiProvider, AiBlock } from './provider';
import type { InteractionType } from '@eduforge/schemas';
import type {
  StructureContentInput, StructureContentOutput,
  GenerateInteractionsInput, GeneratedInteraction,
  MemorialInput, MemorialOutput,
  TutorAnswerInput, TutorAnswerOutput,
  PodcastScriptInput, PodcastScriptOutput,
  SynthesizeInput, SynthesizeOutput,
  IllustrationInput, IllustrationOutput,
} from './provider';

/**
 * MultiProvider: tenta cada provider em ordem até um sucesso.
 * Se todos falharem e `mockFallback` for true, usa o mock (nunca falha).
 * Implementa fallback transparente para todas as operações de IA.
 */
export class MultiProvider implements AiProvider {
  readonly name = 'multi';

  constructor(
    private readonly providers: AiProvider[],
    private readonly mockFallback: AiProvider | null = null,
  ) {}

  private async fallback<T>(
    method: string,
    fn: (p: AiProvider) => Promise<T>,
  ): Promise<T> {
    const errors: string[] = [];
    for (const p of this.providers) {
      try {
        return await fn(p);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${p.name}: ${msg}`);
      }
    }
    // Fallback final
    if (this.mockFallback) {
      try { return await fn(this.mockFallback); } catch { /* último recurso */ }
    }
    throw new Error(`MultiProvider: todos os providers falharam em ${method}. Erros: ${errors.join(' | ')}`);
  }

  async structureContent(i: StructureContentInput) { return this.fallback('structureContent', p => p.structureContent(i)); }
  async generateInteractions(i: GenerateInteractionsInput) { return this.fallback('generateInteractions', p => p.generateInteractions(i)); }
  async regenerateInteraction(i: { block: AiBlock; type: InteractionType; attempt?: number }) { return this.fallback('regenerateInteraction', p => p.regenerateInteraction(i)); }
  async generateMemorial(i: MemorialInput) { return this.fallback('generateMemorial', p => p.generateMemorial(i)); }
  async tutorAnswer(i: TutorAnswerInput) { return this.fallback('tutorAnswer', p => p.tutorAnswer(i)); }
  async generatePodcastScript(i: PodcastScriptInput) { return this.fallback('generatePodcastScript', p => p.generatePodcastScript(i)); }
  async embedTexts(t: string[]) { return this.fallback('embedTexts', p => p.embedTexts(t)); }
  async synthesizeSpeech(i: SynthesizeInput) { return this.fallback('synthesizeSpeech', p => p.synthesizeSpeech(i)); }
  async generateIllustration(i: IllustrationInput) { return this.fallback('generateIllustration', p => p.generateIllustration(i)); }
}
