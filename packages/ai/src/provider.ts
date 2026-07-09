/**
 * Contrato único para toda chamada de IA (PRD §0.2). Nenhum service pode
 * chamar o SDK diretamente — tudo passa por uma implementação de `AiProvider`.
 * As assinaturas de geração de interações, TTS e imagem entram nas milestones
 * M2/M3/M10 — TODO(prd:RF-01, RF-02, RF-06).
 */

export interface StructureContentInput {
  /** Texto extraído do documento-fonte. */
  rawText: string;
  /** Nome do arquivo original (heurística de título). */
  filename: string;
}

export interface StructuredNode {
  title: string;
  kind: 'chapter' | 'section';
  /** Confiança da estruturação, 0..1. */
  confidence: number;
  children?: StructuredNode[];
}

export interface StructureContentOutput {
  tree: StructuredNode[];
}

import type { Difficulty, InteractionType } from '@eduforge/schemas';

export type InteractionDensity = 'light' | 'balanced' | 'intensive';

export interface AiBlock {
  id: string;
  kind: string;
  contentMd: string;
}

export interface GeneratedInteraction {
  type: InteractionType;
  /** Payload bruto — SEMPRE validado por `validateInteraction` antes de persistir. */
  payload: unknown;
  difficulty: Difficulty;
}

export interface GenerateInteractionsInput {
  block: AiBlock;
  density: InteractionDensity;
  types?: InteractionType[];
  /** Tentativa (para variar a saída em regenerações). */
  attempt?: number;
}

export interface MemorialInput {
  title: string;
  slug: string;
  versionNumber: number;
  templateKey: string;
  chapterTitles: string[];
  interactionTypes: string[];
}

export interface MemorialOutput {
  /** Descrição funcional do que o app faz (memorial descritivo, RF-16.1). */
  functionalDescription: string;
  /** Descrição da arquitetura (manifesto imutável, runtime, temas). */
  architectureDescription: string;
  /** Campo de aplicação sugerido para o formulário e-Software. */
  applicationField: string;
  /** Tipo de programa sugerido (ex.: "Aplicativo educacional"). */
  programType: string;
}

// ─────────── M10 — Sensei, podcast, imagens (RF-06.x) ───────────

/** Dimensão do vector no schema (`content_blocks.embedding vector(1536)`). */
export const EMBEDDING_DIM = 1536;

export type SenseiMode = 'default' | 'explain_different' | 'test_me' | 'socratic';
export type SenseiTone = 'formal' | 'descontraido' | 'motivador';

/** Trecho recuperado do RAG (top-k por cosseno) que fundamenta a resposta. */
export interface TutorChunk {
  blockId: string;
  contentMd: string;
  /** `source_ref` do bloco (página/offset no arquivo original). */
  sourceRef: unknown;
  similarity: number; // 0..1
}

export interface TutorAnswerInput {
  question: string;
  mode: SenseiMode;
  tone: SenseiTone;
  tutorName: string;
  /** Contexto já recuperado e filtrado por limiar — vazio = fora de escopo. */
  chunks: TutorChunk[];
}

export interface TutorAnswerOutput {
  answer: string;
  /** Blocos que fundamentam a resposta — o portão de citação exige ≥1 (RF-06.1). */
  citations: { blockId: string }[];
  /** true quando o tutor recusa (fora de escopo). */
  refused: boolean;
}

export interface PodcastScriptInput {
  appTitle: string;
  chapterTitle: string;
  sections: { title: string; contentMd: string }[];
}

export interface PodcastScriptOutput {
  title: string;
  lines: { speaker: 'A' | 'B'; text: string }[];
}

export interface SynthesizeInput {
  lines: { speaker: 'A' | 'B'; text: string }[];
}

export interface SynthesizeOutput {
  audio: Buffer;
  mimeType: string;
  durationSec: number;
}

export interface IllustrationInput {
  chapterTitle: string;
  /** Cores do tema claro do app — a imagem sai estilo-consistente com a paleta. */
  palette: Record<string, string>;
  /** Texto-semente (conteúdo do capítulo) para determinismo. */
  seedText: string;
}

export interface IllustrationOutput {
  svg: string;
  alt: string;
  /** Prompt registrado em `media_assets.meta` (auditoria da geração). */
  prompt: string;
}

export interface AiProvider {
  /** Identificador da implementação (ex.: "mock", "anthropic"). */
  readonly name: string;

  /**
   * Estrutura texto bruto em um Mapa de Conteúdo (capítulos/seções).
   * RF-01 — a implementação real (LLM) chega quando AI_PROVIDER=anthropic.
   */
  structureContent(input: StructureContentInput): Promise<StructureContentOutput>;

  /** Gera um lote de interações para um bloco (RF-02). */
  generateInteractions(input: GenerateInteractionsInput): Promise<GeneratedInteraction[]>;

  /** Regenera uma única interação de um tipo (RF-02, ação "Regenerar"). */
  regenerateInteraction(input: {
    block: AiBlock;
    type: InteractionType;
    attempt?: number;
  }): Promise<GeneratedInteraction>;

  /** Gera o memorial descritivo para o Pacote INPI (RF-16.1). */
  generateMemorial(input: MemorialInput): Promise<MemorialOutput>;

  /** Embeddings (1536 dims, L2-normalizados) para o RAG do Sensei (RF-06.1). */
  embedTexts(texts: string[]): Promise<number[][]>;

  /** Resposta do tutor a partir do contexto recuperado — SEMPRE passa pelo portão de citação depois. */
  tutorAnswer(input: TutorAnswerInput): Promise<TutorAnswerOutput>;

  /** Roteiro de podcast com dois apresentadores para um capítulo (RF-06.5). */
  generatePodcastScript(input: PodcastScriptInput): Promise<PodcastScriptOutput>;

  /** Síntese de fala do roteiro (RF-06.5) — mock produz WAV tocável. */
  synthesizeSpeech(input: SynthesizeInput): Promise<SynthesizeOutput>;

  /** Ilustração de capítulo estilo-consistente com a paleta (M10 "imagens IA"). */
  generateIllustration(input: IllustrationInput): Promise<IllustrationOutput>;
}
