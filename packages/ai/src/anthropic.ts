import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider, StructuredNode } from './provider';
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
import { MockAiProvider } from './mock';

/**
 * Provider real via API Anthropic para tarefas textuais (estruturação,
 * geração, memorial, tutor, podcast). Embedding, síntese de fala e
 * ilustração usam o mock (precisam de modelos específicos não disponíveis
 * na API Messages padrão).
 */
export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly mock: MockAiProvider;
  private readonly model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey });
    this.mock = new MockAiProvider();
    this.model = model;
  }

  private async chat(system: string, user: string, maxTokens = 4096): Promise<string> {
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const block = msg.content.find((c) => c.type === 'text');
    return (block as any)?.text ?? '';
  }

  async structureContent(input: StructureContentInput): Promise<StructureContentOutput> {
    const system = `Você é um extrator de estrutura de documentos educacionais. Analise o texto e produza um JSON com capítulos e seções. Formato: {"tree":[{"title":"...","confidence":0.9,"children":[{"title":"...","excerpt":"...","confidence":0.8}]}]}`;
    const user = `Arquivo: ${input.filename}\n\nConteúdo:\n${input.rawText}`;
    const raw = await this.chat(system, user, 8192);
    try {
      const parsed = JSON.parse(raw) as { tree?: StructuredNode[] };
      return { tree: parsed.tree ?? [] };
    } catch {
      return { tree: [] };
    }
  }

  async generateInteractions(input: GenerateInteractionsInput): Promise<GeneratedInteraction[]> {
    const types = input.types?.join(', ') ?? 'quiz, flashcard_deck, cloze';
    const system = `Você é um gerador de interações educacionais. Crie interações dos tipos: ${types}. Retorne APENAS JSON array. Cada item: {"type":"...","payload":{...},"difficulty":"medium","xp":10}`;
    const user = `Bloco (${input.block.kind ?? 'concept'}):\n${input.block.contentMd}\nDensidade: ${input.density}\nTentativa: ${input.attempt ?? 1}`;
    const raw = await this.chat(system, user, 8192);
    try {
      return JSON.parse(raw) as GeneratedInteraction[];
    } catch {
      return [];
    }
  }

  async regenerateInteraction(input: {
    block: { contentMd: string; kind?: string };
    type: string;
    attempt?: number;
  }): Promise<GeneratedInteraction> {
    const system = `Regenere UMA interação educacional do tipo "${input.type}" a partir do conteúdo. Retorne APENAS JSON. Formato: {"type":"${input.type}","payload":{...},"difficulty":"medium","xp":10}`;
    const user = `Conteúdo:\n\n${input.block.contentMd}\nTentativa: ${input.attempt ?? 1}`;
    const raw = await this.chat(system, user, 4096);
    try {
      return JSON.parse(raw) as GeneratedInteraction;
    } catch {
      return { type: input.type as any, payload: {}, difficulty: 'medium', xp: 10 } as any;
    }
  }

  async generateMemorial(input: MemorialInput): Promise<MemorialOutput> {
    const system = `Você é um redator técnico jurídico brasileiro. Escreva um memorial descritivo para registro de software no INPI. Use português formal.`;
    const user = `App: ${input.title} (slug: ${input.slug})\nVersão: ${input.versionNumber}\nTemplate: ${input.templateKey}\nCapítulos: ${input.chapterTitles.join(', ')}\nTipos de interação: ${input.interactionTypes.join(', ')}`;
    const raw = await this.chat(system, user, 8192);
    return {
      functionalDescription: raw,
      architectureDescription: `Aplicativo educacional "${input.title}" construído com EduForge, utilizando template ${input.templateKey} e ${input.interactionTypes.length} tipos de interação.`,
      applicationField: 'Educação — ensino assistido por tecnologia',
      programType: 'Aplicativo educacional',
    };
  }

  async tutorAnswer(input: TutorAnswerInput): Promise<TutorAnswerOutput> {
    if (input.chunks.length === 0) {
      return { answer: 'Desculpe, não encontrei informação sobre isso no material.', citations: [], refused: true };
    }

    const contextText = input.chunks
      .map((c, i) => `[FONTE ${i + 1}] (p. ${(c.sourceRef as any)?.page ?? '?'}): ${c.contentMd}`)
      .join('\n\n');

    const modeInstructions: Record<string, string> = {
      default: 'Responda de forma clara e didática, citando as fontes.',
      explain_different: 'Explique o mesmo conceito de uma forma diferente, usando analogias.',
      test_me: 'Crie uma pergunta de teste sobre o conteúdo e aguarde a resposta do aluno.',
      socratic: 'Responda com perguntas que guiem o aprendiz a descobrir a resposta por conta própria.',
    };

    const system = `Você é "${input.tutorName}", um tutor com tom ${input.tone}. Use APENAS o conteúdo das fontes. Se a pergunta não puder ser respondida com as fontes, recuse. Sempre cite com [FONTE N]. ${modeInstructions[input.mode] ?? modeInstructions.default}`;

    const user = `Fontes:\n${contextText}\n\nPergunta: ${input.question}`;
    const raw = await this.chat(system, user, 2048);

    const citations: { blockId: string }[] = [];
    const sourceRegex = /\[FONTE\s+(\d+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = sourceRegex.exec(raw)) !== null) {
      const idx = parseInt(match[1]!, 10) - 1;
      const chunk = input.chunks[idx];
      if (chunk && !citations.some((c) => c.blockId === chunk.blockId)) {
        citations.push({ blockId: chunk.blockId });
      }
    }

    if (citations.length === 0) {
      return { answer: raw, citations: [], refused: true };
    }

    return { answer: raw, citations, refused: false };
  }

  async generatePodcastScript(input: PodcastScriptInput): Promise<PodcastScriptOutput> {
    const sectionsText = input.sections.map((s) => `## ${s.title}\n${s.contentMd}`).join('\n\n');
    const system = `Você é um roteirista de podcast educacional. Crie um diálogo natural entre dois apresentadores (A e B).`;
    const user = `App: ${input.appTitle}\nCapítulo: ${input.chapterTitle}\n\nConteúdo:\n${sectionsText}\n\nJSON: {"title":"...","lines":[{"speaker":"A","text":"..."},{"speaker":"B","text":"..."},...]}`;
    const raw = await this.chat(system, user, 8192);
    try {
      return JSON.parse(raw) as PodcastScriptOutput;
    } catch {
      return {
        title: input.chapterTitle,
        lines: input.sections.map((s, i) => ({ speaker: (i % 2 === 0 ? 'A' : 'B') as 'A' | 'B', text: s.contentMd })),
      };
    }
  }

  // ─────────── Delegam ao mock (modelos não disponíveis via API Messages) ───────────

  async embedTexts(texts: string[]): Promise<number[][]> {
    return this.mock.embedTexts(texts);
  }

  async synthesizeSpeech(input: SynthesizeInput): Promise<SynthesizeOutput> {
    return this.mock.synthesizeSpeech(input);
  }

  async generateIllustration(input: IllustrationInput): Promise<IllustrationOutput> {
    return this.mock.generateIllustration(input);
  }
}
