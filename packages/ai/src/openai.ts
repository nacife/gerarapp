import OpenAI from 'openai';
import type { AiBlock, AiProvider, StructuredNode } from './provider';
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
import { MockAiProvider } from './mock';

/**
 * Provider via API OpenAI (GPT-4o/GPT-4o-mini). Embedding, síntese e ilustração delegam ao mock.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly mock: MockAiProvider;
  private readonly model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.client = new OpenAI({ apiKey });
    this.mock = new MockAiProvider();
    this.model = model;
  }

  private async chat(system: string, user: string, maxTokens = 4096): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model, max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    return res.choices[0]?.message?.content ?? '';
  }

  async structureContent(input: StructureContentInput): Promise<StructureContentOutput> {
    const raw = await this.chat('Extraia a estrutura do documento como JSON com capítulos e seções.', `Arquivo: ${input.filename}\n\n${input.rawText}`, 8192);
    try { return JSON.parse(raw) as StructureContentOutput; } catch { return { tree: [] }; }
  }

  async generateInteractions(input: GenerateInteractionsInput): Promise<GeneratedInteraction[]> {
    const types = input.types?.join(', ') ?? 'quiz, flashcard_deck, cloze';
    const raw = await this.chat(`Gere interações educacionais do tipo ${types}. Retorne JSON array.`, `Bloco: ${input.block.contentMd}\nDensidade: ${input.density}`, 8192);
    try { return JSON.parse(raw) as GeneratedInteraction[]; } catch { return []; }
  }

  async regenerateInteraction(input: { block: AiBlock; type: InteractionType; attempt?: number }): Promise<GeneratedInteraction> {
    const raw = await this.chat(`Regenere UMA interação do tipo ${input.type}. JSON.`, input.block.contentMd, 4096);
    try { return JSON.parse(raw) as GeneratedInteraction; } catch { return { type: input.type as any, payload: {}, difficulty: 'medium' } as any; }
  }

  async generateMemorial(input: MemorialInput): Promise<MemorialOutput> {
    const raw = await this.chat('Escreva memorial descritivo para registro de software no INPI.', `App: ${input.title}\nCapítulos: ${input.chapterTitles.join(', ')}`, 8192);
    return { functionalDescription: raw, architectureDescription: `App ${input.title}`, applicationField: 'Educação', programType: 'Aplicativo educacional' };
  }

  async tutorAnswer(input: TutorAnswerInput): Promise<TutorAnswerOutput> {
    if (input.chunks.length === 0) return { answer: 'Fora do escopo.', citations: [], refused: true };
    const ctx = input.chunks.map((c, i) => `[FONTE ${i + 1}] p.${(c.sourceRef as any)?.page ?? '?'}: ${c.contentMd}`).join('\n\n');
    const raw = await this.chat(`Você é "${input.tutorName}", tom ${input.tone}. Use APENAS as fontes. Cite [FONTE N].`, `Fontes:\n${ctx}\n\nPergunta: ${input.question}`, 2048);
    const citations: { blockId: string }[] = [];
    const re = /\[FONTE\s+(\d+)\]/g; let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) { const idx = parseInt(m[1]!) - 1; const c = input.chunks[idx]; if (c && !citations.some(x => x.blockId === c.blockId)) citations.push({ blockId: c.blockId }); }
    if (citations.length === 0) return { answer: raw, citations: [], refused: true };
    return { answer: raw, citations, refused: false };
  }

  async generatePodcastScript(input: PodcastScriptInput): Promise<PodcastScriptOutput> {
    const txt = input.sections.map(s => `## ${s.title}\n${s.contentMd}`).join('\n\n');
    const raw = await this.chat('Crie roteiro de podcast com 2 apresentadores (A e B). JSON: {"title":"...","lines":[{"speaker":"A","text":"..."}]}', `${input.appTitle} - ${input.chapterTitle}\n\n${txt}`, 8192);
    try { return JSON.parse(raw); } catch { return { title: input.chapterTitle, lines: input.sections.map((s, i) => ({ speaker: (i % 2 === 0 ? 'A' : 'B') as 'A' | 'B', text: s.contentMd })) }; }
  }

  async embedTexts(texts: string[]): Promise<number[][]> { return this.mock.embedTexts(texts); }
  async synthesizeSpeech(input: SynthesizeInput): Promise<SynthesizeOutput> { return this.mock.synthesizeSpeech(input); }
  async generateIllustration(input: IllustrationInput): Promise<IllustrationOutput> { return this.mock.generateIllustration(input); }
}
