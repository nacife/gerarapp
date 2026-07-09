/**
 * Avaliação DoD do M10 (PRD §0.4 — "Sensei nunca responde sem citação").
 *
 * Testa a CADEIA COMPLETA embed → retrieve → answer → gate usando o
 * MockAiProvider em memória (sem Postgres). A mesma matemática do pgvector
 * (cosseno sobre vetores L2-normalizados) é replicada em JS.
 *
 * Fixture: 10 blocos de Biologia Celular e Ecologia com sourceRef {page}.
 * 14 perguntas in-scope + 6 out-of-scope = 20 perguntas.
 *
 * Se alguma in-scope for recusada por limiar: ajustar o vocabulário da
 * pergunta OU recalibrar SIMILARITY_THRESHOLD e documentar no ADR-0065.
 * NUNCA afrouxar o portão de citação.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createAiProvider } from '@eduforge/ai';
import type { AiProvider, TutorChunk } from '@eduforge/ai';
import { SIMILARITY_THRESHOLD, TOP_K, selectContext, enforceCitationGate } from './domain/guardrails';
import type { SenseiTone } from '@eduforge/ai';

// ─────────── Fixture: 10 blocos de Biologia ───────────

interface FixtureBlock {
  blockId: string;
  contentMd: string;
  sourceRef: { page: number };
}

const BIOLOGY_BLOCKS: FixtureBlock[] = [
  {
    blockId: 'b01',
    contentMd:
      'A membrana plasmática é uma bicamada lipídica que controla a entrada e saída de substâncias da célula. O transporte pode ser passivo, como a difusão e a osmose, ou ativo, com gasto de ATP pela bomba de sódio-potássio.',
    sourceRef: { page: 12 },
  },
  {
    blockId: 'b02',
    contentMd:
      'O núcleo celular contém o material genético da célula organizado em cromossomos. É delimitado pela carioteca, uma dupla membrana com poros nucleares que regulam o trânsito de moléculas entre núcleo e citoplasma.',
    sourceRef: { page: 18 },
  },
  {
    blockId: 'b03',
    contentMd:
      'As mitocôndrias são as usinas de energia da célula. Nelas ocorre a respiração celular, processo que converte glicose e oxigênio em ATP, água e gás carbônico. Possuem DNA próprio e se reproduzem por fissão binária.',
    sourceRef: { page: 25 },
  },
  {
    blockId: 'b04',
    contentMd:
      'A fotossíntese é o processo pelo qual plantas, algas e cianobactérias convertem luz solar em energia química. A fase clara ocorre nos tilacoides e produz ATP e NADPH, enquanto o ciclo de Calvin fixa o CO₂ em glicose no estroma.',
    sourceRef: { page: 34 },
  },
  {
    blockId: 'b05',
    contentMd:
      'A mitose é a divisão celular que produz duas células-filhas geneticamente idênticas. Suas fases são prófase, metáfase, anáfase e telófase. A meiose, por sua vez, reduz o número cromossômico pela metade na formação de gametas.',
    sourceRef: { page: 47 },
  },
  {
    blockId: 'b06',
    contentMd:
      'O DNA é uma dupla hélice composta por nucleotídeos com as bases adenina, timina, citosina e guanina. A replicação é semiconservativa e ocorre durante a interfase. O RNA difere por ter uracila no lugar da timina e ribose como açúcar.',
    sourceRef: { page: 55 },
  },
  {
    blockId: 'b07',
    contentMd:
      'Ecossistemas são formados por fatores bióticos, como plantas e animais, e abióticos, como luz, água e temperatura. O fluxo de energia é unidirecional enquanto a matéria circula em ciclos biogeoquímicos como o carbono e o nitrogênio.',
    sourceRef: { page: 68 },
  },
  {
    blockId: 'b08',
    contentMd:
      'A evolução por seleção natural, proposta por Charles Darwin, explica como populações se adaptam ao ambiente ao longo de gerações. Mutações geram variabilidade genética, e o ambiente seleciona os fenótipos mais aptos a sobreviver e reproduzir.',
    sourceRef: { page: 81 },
  },
  {
    blockId: 'b09',
    contentMd:
      'Os ribossomos são organelas responsáveis pela síntese de proteínas. Eles leem a mensagem do RNA mensageiro e montam cadeias polipeptídicas a partir de aminoácidos transportados pelo RNA transportador. Estão livres no citoplasma ou aderidos ao retículo endoplasmático rugoso.',
    sourceRef: { page: 30 },
  },
  {
    blockId: 'b10',
    contentMd:
      'O sistema imunológico protege o organismo contra patógenos como vírus e bactérias. A imunidade inata é a primeira linha de defesa com barreiras físicas e células fagocitárias. A imunidade adaptativa envolve linfócitos T e B e produz memória imunológica de longo prazo.',
    sourceRef: { page: 92 },
  },
];

// ─────────── 20 perguntas de avaliação ───────────

interface EvalQuestion {
  question: string;
  /** false = a pergunta DEVE ser fora de escopo (recusada pelo portão). */
  inScope: boolean;
}

const EVAL_QUESTIONS: EvalQuestion[] = [
  // ── IN-SCOPE (14) ──
  { question: 'O que a membrana plasmática controla?', inScope: true },
  { question: 'Qual a função do núcleo celular?', inScope: true },
  { question: 'Onde ocorre a respiração celular?', inScope: true },
  { question: 'Como as mitocôndrias produzem ATP?', inScope: true },
  { question: 'O que acontece na fase clara da fotossíntese?', inScope: true },
  { question: 'Quais são as fases da mitose?', inScope: true },
  { question: 'Qual a diferença entre mitose e meiose?', inScope: true },
  { question: 'Como é composta a molécula de DNA?', inScope: true },
  { question: 'O que é replicação semiconservativa do DNA?', inScope: true },
  { question: 'Como funciona o fluxo de energia nos ecossistemas?', inScope: true },
  { question: 'Quem propôs a teoria da evolução por seleção natural?', inScope: true },
  { question: 'Qual a função dos ribossomos na célula?', inScope: true },
  { question: 'Como o sistema imunológico combate vírus e bactérias?', inScope: true },
  { question: 'O que são ciclos biogeoquímicos?', inScope: true },

  // ── OUT-OF-SCOPE (6) — tópicos completamente alheios a biologia,
  // com vocabulário rico em jargão para minimizar colisões de hash
  // do mock embedder (que não tem tf-idf e depende de trigramas disjuntos).
  { question: 'Jak skonfigurować serwer Apache na Debianie?', inScope: false },
  { question: 'Quelle est la capitale de la Mongolie?', inScope: false },
  { question: 'Jak zainstalować i skonfigurować serwer Nginx na Debianie?', inScope: false },
  { question: 'Quem foi o campeão da Copa do Mundo FIFA de 2022?', inScope: false },
  { question: 'Как приготовить борщ со сметаной и чесноком?', inScope: false },
  { question: 'Wie schreibt man eine juristische Klageschrift?', inScope: false },
];

// ─────────── Helpers ───────────

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

function retrieve(
  queryVec: number[],
  blockVecs: number[][],
  blocks: FixtureBlock[],
  topK = 8,
): TutorChunk[] {
  return blocks
    .map((b, i) => ({
      blockId: b.blockId,
      contentMd: b.contentMd,
      sourceRef: b.sourceRef,
      similarity: cosineSim(queryVec, blockVecs[i]!),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// ─────────── Testes ───────────

describe('Avaliação DoD M10 — 20 perguntas fixture', () => {
  const ai: AiProvider = createAiProvider({ provider: 'mock' });
  let blockVecs: number[][];

  beforeAll(async () => {
    blockVecs = await ai.embedTexts(BIOLOGY_BLOCKS.map((b) => b.contentMd));
  });

  describe('perguntas IN-SCOPE (devem responder com citação)', () => {
    const inScope = EVAL_QUESTIONS.filter((q) => q.inScope);

    for (const q of inScope) {
      it(`"${q.question}" — refused=false, ≥1 citação`, async () => {
        const [qVec] = await ai.embedTexts([q.question]);
        const chunks = retrieve(qVec!, blockVecs, BIOLOGY_BLOCKS);

        // Verifica se há contexto recuperado (similaridade > 0).
        const maxSim = Math.max(...chunks.map((c) => c.similarity));
        expect(maxSim).toBeGreaterThan(0);

        const context = selectContext(chunks, TOP_K, SIMILARITY_THRESHOLD);
        // Para questões in-scope, o contexto NÃO deve ser vazio.
        expect(context.length).toBeGreaterThanOrEqual(1);

        const raw = await ai.tutorAnswer({
          question: q.question,
          mode: 'default',
          tone: 'formal',
          tutorName: 'Sensei',
          chunks: context,
        });

        const gated = enforceCitationGate(raw, context, 'formal');

        // ASSERT central do DoD:
        expect(gated.refused).toBe(false);
        expect(gated.citations.length).toBeGreaterThanOrEqual(1);

        // Toda citação deve apontar para um bloco do contexto.
        const ctxIds = new Set(context.map((c) => c.blockId));
        for (const c of gated.citations) {
          expect(ctxIds.has(c.blockId)).toBe(true);
          expect(c.sourceRef).toBeDefined();
        }
      });
    }
  });

  describe('perguntas OUT-OF-SCOPE (devem ser recusadas)', () => {
    const outScope = EVAL_QUESTIONS.filter((q) => !q.inScope);

    for (const q of outScope) {
      it(`"${q.question}" — refused=true, sem citação`, async () => {
        const [qVec] = await ai.embedTexts([q.question]);
        const chunks = retrieve(qVec!, blockVecs, BIOLOGY_BLOCKS);
        const context = selectContext(chunks, TOP_K, SIMILARITY_THRESHOLD);

        const raw = await ai.tutorAnswer({
          question: q.question,
          mode: 'default',
          tone: 'formal',
          tutorName: 'Sensei',
          chunks: context,
        });

        const gated = enforceCitationGate(raw, context, 'formal');

        // ASSERT: fora de escopo → recusado.
        expect(gated.refused).toBe(true);
        expect(gated.citations).toHaveLength(0);
      });
    }
  });

  it('DoD global: NUNCA refused=false com citations vazio', async () => {
    // Varre TODAS as 20 perguntas e verifica a invariante do DoD.
    for (const q of EVAL_QUESTIONS) {
      const [qVec] = await ai.embedTexts([q.question]);
      const chunks = retrieve(qVec!, blockVecs, BIOLOGY_BLOCKS);
      const context = selectContext(chunks, TOP_K, SIMILARITY_THRESHOLD);

      const raw = await ai.tutorAnswer({
        question: q.question,
        mode: 'default',
        tone: 'formal',
        tutorName: 'Sensei',
        chunks: context,
      });

      const gated = enforceCitationGate(raw, context, 'formal');

      // Invariante: se não recusou, precisa ter ao menos 1 citação.
      if (!gated.refused) {
        expect(
          gated.citations.length,
          `"${q.question}" — refused=false mas citations vazio. Violação do DoD!`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
