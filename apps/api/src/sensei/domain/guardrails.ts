import type { SenseiTone, TutorAnswerOutput, TutorChunk } from '@eduforge/ai';

/** Similaridade mínima para um bloco entrar no contexto — abaixo disto é "fora de escopo". */
export const SIMILARITY_THRESHOLD = 0.12;
/** Quantos blocos alimentam o tutor por pergunta. */
export const TOP_K = 4;

/** Recusa padrão do PORTÃO (fallback de segurança) — não confundir com a recusa do provider. */
export const GATE_REFUSALS: Record<SenseiTone, string> = {
  formal:
    'Não encontrei fundamento para essa pergunta no conteúdo deste material. Posso ajudar com os tópicos abordados nos capítulos do app.',
  descontraido:
    'Hmm, essa eu não consigo responder com o material daqui! Me pergunta algo do conteúdo do app. 😉',
  motivador:
    'Essa pergunta vai além do material — mas não desanima! Me pergunta qualquer coisa dos capítulos que eu te ajudo a dominar o conteúdo.',
};

/** Filtra o retrieval bruto: só blocos acima do limiar, no máximo top-k, mais similares primeiro. */
export function selectContext(
  chunks: TutorChunk[],
  topK: number = TOP_K,
  threshold: number = SIMILARITY_THRESHOLD,
): TutorChunk[] {
  return chunks
    .filter((c) => c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

export interface GatedCitation {
  blockId: string;
  sourceRef: unknown;
}

export interface GatedAnswer {
  answer: string;
  citations: GatedCitation[];
  refused: boolean;
}

/**
 * O portão do DoD (M10): "o Sensei NUNCA responde sem citação". Toda resposta
 * do provider passa por aqui antes de chegar ao aprendiz — citações que não
 * apontam para blocos do contexto recuperado são descartadas, e uma resposta
 * que fique sem NENHUMA citação válida vira recusa. Vale para qualquer
 * implementação de AiProvider (mock ou LLM real): o portão é estrutural,
 * não confia no provider.
 */
export function enforceCitationGate(
  raw: TutorAnswerOutput,
  context: TutorChunk[],
  tone: SenseiTone,
): GatedAnswer {
  if (raw.refused) {
    return { answer: raw.answer, citations: [], refused: true };
  }

  const byId = new Map(context.map((c) => [c.blockId, c]));
  const citations: GatedCitation[] = [];
  for (const cited of raw.citations) {
    const chunk = byId.get(cited.blockId);
    if (chunk && !citations.some((c) => c.blockId === chunk.blockId)) {
      citations.push({ blockId: chunk.blockId, sourceRef: chunk.sourceRef });
    }
  }

  if (citations.length === 0) {
    return { answer: GATE_REFUSALS[tone], citations: [], refused: true };
  }

  return { answer: raw.answer, citations, refused: false };
}
