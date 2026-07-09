import {
  DIFFICULTIES,
  buildValidInteraction,
  type Difficulty,
  type InteractionType,
} from '@eduforge/schemas';
import {
  EMBEDDING_DIM,
  type AiBlock,
  type AiProvider,
  type GenerateInteractionsInput,
  type GeneratedInteraction,
  type IllustrationInput,
  type IllustrationOutput,
  type InteractionDensity,
  type MemorialInput,
  type MemorialOutput,
  type PodcastScriptInput,
  type PodcastScriptOutput,
  type StructureContentInput,
  type StructureContentOutput,
  type StructuredNode,
  type SynthesizeInput,
  type SynthesizeOutput,
  type TutorAnswerInput,
  type TutorAnswerOutput,
} from './provider';

const TYPE_LABEL_PT: Record<string, string> = {
  quiz: 'questionários de múltipla escolha',
  flashcard_deck: 'baralhos de flashcards com repetição espaçada',
  cloze: 'exercícios de preenchimento de lacunas',
  dragdrop: 'atividades de arrastar-e-soltar',
  timeline: 'linhas do tempo interativas',
  hotspot: 'imagens com pontos de interesse (hotspots)',
  scenario: 'cenários de decisão ramificados',
  audio: 'trilhas de áudio narradas',
  mindmap: 'mapas mentais interativos',
};

/** Tipos gerados por padrão (sem os que exigem mídia: hotspot/audio). */
const DEFAULT_TYPES: InteractionType[] = [
  'quiz',
  'flashcard_deck',
  'cloze',
  'dragdrop',
  'timeline',
  'mindmap',
];

const DENSITY_RANGE: Record<InteractionDensity, [number, number]> = {
  light: [1, 2],
  balanced: [2, 4],
  intensive: [4, 6],
};

/** Hash determinístico simples (FNV-1a) para respostas estáveis em dev/testes. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Tokeniza sem acentos/pontuação — base do embedding lexical do mock. */
function tokenize(text: string): string[] {
  // A classe do regex é U+0300–U+036F (diacríticos combinantes pós-NFD).
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/**
 * Embedding determinístico por bag-of-features (palavra inteira + trigramas)
 * hasheada em 1536 dims e L2-normalizada: textos com vocabulário em comum têm
 * cosseno alto de verdade — o RAG do mock funciona por sobreposição lexical,
 * sem rede e sem custo. Um embedding real (API) entra pela mesma interface.
 */
function mockEmbed(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);
  for (const token of tokenize(text)) {
    const features = [token];
    for (let i = 0; i + 3 <= token.length; i++) features.push(token.slice(i, i + 3));
    for (const feature of features) {
      const h = fnv1a(feature);
      vec[h % EMBEDDING_DIM] += 1;
      vec[(h >>> 9) % EMBEDDING_DIM] += 0.5; // segundo hash espalha colisões
    }
  }
  let sumSq = 0;
  for (const v of vec) sumSq += v * v;
  const len = Math.sqrt(sumSq) || 1;
  return Array.from(vec, (v) => v / len);
}

/** Primeira(s) sentença(s) de um markdown, sem cabeçalhos, com limite de tamanho. */
function leadSentences(contentMd: string, maxChars = 280): string {
  const plain = contentMd
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxChars) return plain;
  const cut = plain.slice(0, maxChars);
  const lastStop = cut.lastIndexOf('. ');
  return lastStop > 80 ? cut.slice(0, lastStop + 1) : `${cut}…`;
}

const REFUSALS: Record<string, string> = {
  formal:
    'Esta pergunta está fora do conteúdo deste material. Posso ajudar com qualquer tópico abordado nos capítulos do app.',
  descontraido:
    'Opa — isso aí não está no material que a gente tem aqui! Me pergunta algo do conteúdo do app que eu te ajudo. 😉',
  motivador:
    'Boa pergunta, mas ela vai além deste material! Foca no conteúdo do app que eu te levo longe — me pergunta qualquer coisa dos capítulos.',
};

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  if (!base) return 'Documento';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Implementação determinística para dev/testes (PRD §0.2): a mesma entrada
 * sempre produz a mesma árvore plausível. Sem custo, sem rede.
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async structureContent(input: StructureContentInput): Promise<StructureContentOutput> {
    const seed = fnv1a(input.rawText + input.filename);
    const chapterCount = 3 + (seed % 3); // 3..5 capítulos
    const docTitle = titleFromFilename(input.filename);

    const tree: StructuredNode[] = Array.from({ length: chapterCount }, (_, ci) => {
      // `>>>` (unsigned) garante módulo não-negativo mesmo com hash > 2^31.
      const sectionCount = 2 + ((seed >>> (ci + 1)) % 3); // 2..4 seções
      const children: StructuredNode[] = Array.from({ length: sectionCount }, (_, si) => ({
        title: `${docTitle} — Seção ${ci + 1}.${si + 1}`,
        kind: 'section' as const,
        confidence: 0.72 + ((seed >>> (ci + si)) % 25) / 100, // 0.72..0.96
      }));
      return {
        title: `Capítulo ${ci + 1}`,
        kind: 'chapter' as const,
        confidence: 0.85 + ((seed >>> ci) % 12) / 100, // 0.85..0.96
        children,
      };
    });

    return { tree };
  }

  async generateInteractions(input: GenerateInteractionsInput): Promise<GeneratedInteraction[]> {
    const pool = input.types?.length ? input.types : DEFAULT_TYPES;
    const seed = fnv1a(`${input.block.id}|${input.density}|${input.attempt ?? 0}`);
    const [min, max] = DENSITY_RANGE[input.density];
    const count = min + (seed % (max - min + 1));

    return Array.from({ length: count }, (_, i) => {
      const type = pool[(seed + i) % pool.length];
      const difficulty = DIFFICULTIES[(seed + i) % DIFFICULTIES.length] as Difficulty;
      return {
        type,
        payload: buildValidInteraction(type, input.block.id, seed + i),
        difficulty,
      };
    });
  }

  async regenerateInteraction(input: {
    block: AiBlock;
    type: InteractionType;
    attempt?: number;
  }): Promise<GeneratedInteraction> {
    const seed = fnv1a(`${input.block.id}|${input.type}|${input.attempt ?? 0}|${Date.now()}`);
    return {
      type: input.type,
      payload: buildValidInteraction(input.type, input.block.id, seed),
      difficulty: 'medium',
    };
  }

  async generateMemorial(input: MemorialInput): Promise<MemorialOutput> {
    const interactionNames = input.interactionTypes
      .map((t) => TYPE_LABEL_PT[t] ?? t)
      .join(', ');
    const chapterList = input.chapterTitles.map((t) => `“${t}”`).join(', ');

    const functionalDescription =
      `O programa de computador "${input.title}" é um aplicativo de aprendizagem interativo ` +
      `(PWA — Progressive Web App), gerado pela plataforma EduForge a partir de conteúdo ` +
      `fornecido pelo titular e publicado na versão ${input.versionNumber} sob o identificador ` +
      `"${input.slug}". O programa organiza o conteúdo educacional em capítulos e seções ` +
      (chapterList ? `(${chapterList}) ` : '') +
      `e apresenta, a cada seção, atividades interativas de fixação de aprendizagem, incluindo ` +
      `${interactionNames || 'atividades interativas diversas'}. O aprendiz progride pelo ` +
      `conteúdo, recebe pontuação de experiência (XP), mantém sequência de estudo (streak) e, ` +
      `ao concluir o percurso, recebe certificado de conclusão verificável.`;

    const architectureDescription =
      `O programa é composto por (i) um manifesto de conteúdo imutável em formato JSON, que ` +
      `descreve a estrutura do conteúdo, o tema visual ("${input.templateKey}") e a definição ` +
      `de cada interação; e (ii) um motor de execução ("runtime") em JavaScript/TypeScript, ` +
      `derivado do runtime licenciado da plataforma EduForge (ver campo "derivação autorizada"), ` +
      `responsável por interpretar o manifesto e renderizar as telas, capturar respostas do ` +
      `aprendiz, calcular o progresso e emitir eventos de aprendizagem. O programa é distribuído ` +
      `como aplicativo web progressivo (PWA), instalável e com funcionamento offline básico.`;

    return {
      functionalDescription,
      architectureDescription,
      applicationField: 'Educação — ensino e aprendizagem à distância (e-learning)',
      programType: 'Aplicativo educacional interativo (PWA)',
    };
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return texts.map(mockEmbed);
  }

  async tutorAnswer(input: TutorAnswerInput): Promise<TutorAnswerOutput> {
    if (input.chunks.length === 0) {
      return { answer: REFUSALS[input.tone] ?? REFUSALS.formal!, citations: [], refused: true };
    }

    const top = input.chunks.slice(0, 2);
    const base = top.map((c) => leadSentences(c.contentMd)).join(' ');
    const citations = top.map((c) => ({ blockId: c.blockId }));
    const opener =
      input.tone === 'descontraido' ? 'Então, olha só:' : input.tone === 'motivador' ? 'Ótima pergunta — vamos nessa!' : 'Com base no material:';

    let answer: string;
    switch (input.mode) {
      case 'explain_different':
        answer =
          `${opener} pense assim — ${base} Em outras palavras, é como um processo em etapas ` +
          `que você pode observar no dia a dia: cada parte descrita acima cumpre um papel nessa engrenagem.`;
        break;
      case 'test_me':
        answer =
          `${opener} vamos testar! Com base no material: ${base} ` +
          `Pergunta 1: como você explicaria esse conceito com as suas palavras? ` +
          `Pergunta 2: qual etapa descrita acima você considera mais importante, e por quê?`;
        break;
      case 'socratic':
        answer =
          `${opener} antes de eu responder direto — o material diz que ${base} ` +
          `O que isso sugere sobre a sua pergunta? Que relação você enxerga entre esses pontos?`;
        break;
      default:
        answer = `${opener} ${base}`;
    }

    return { answer, citations, refused: false };
  }

  async generatePodcastScript(input: PodcastScriptInput): Promise<PodcastScriptOutput> {
    const lines: PodcastScriptOutput['lines'] = [
      { speaker: 'A', text: `Bem-vindos ao podcast de "${input.appTitle}"! Hoje o papo é sobre "${input.chapterTitle}".` },
      { speaker: 'B', text: 'E olha, esse capítulo tem mais coisa do que parece — vamos por partes.' },
    ];
    for (const [i, section] of input.sections.entries()) {
      const gist = leadSentences(section.contentMd, 200);
      lines.push({ speaker: i % 2 === 0 ? 'A' : 'B', text: `Sobre "${section.title}": ${gist}` });
      if (i === 0 && input.sections.length > 1) {
        lines.push({
          speaker: 'B',
          text: 'Hmm, eu discordaria de colocar assim tão simples — na prática tem nuance, e é aí que a próxima parte entra.',
        });
      }
    }
    lines.push({ speaker: 'A', text: 'Recapitulando o essencial de hoje: revise as seções e teste-se nas interações do app.' });
    lines.push({ speaker: 'B', text: 'É isso! Até o próximo capítulo.' });
    return { title: `Episódio — ${input.chapterTitle}`, lines };
  }

  async synthesizeSpeech(input: SynthesizeInput): Promise<SynthesizeOutput> {
    // WAV PCM 16-bit mono 8 kHz TOCÁVEL: cada fala vira um tom (vozes A=220Hz,
    // B=330Hz) com duração proporcional ao texto — determinístico e barato.
    const sampleRate = 8000;
    const segments = input.lines.map((line) => ({
      freq: line.speaker === 'A' ? 220 : 330,
      samples: Math.min(Math.max(Math.round(line.text.length * 0.03 * sampleRate), sampleRate / 4), sampleRate * 6),
    }));
    const gapSamples = Math.round(sampleRate * 0.15);
    const totalSamples = segments.reduce((acc, s) => acc + s.samples + gapSamples, 0);

    const dataSize = totalSamples * 2;
    const buffer = Buffer.alloc(44 + dataSize);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    let offset = 44;
    for (const segment of segments) {
      for (let i = 0; i < segment.samples; i++) {
        const fade = Math.min(1, i / 200, (segment.samples - i) / 200);
        const value = Math.round(Math.sin((2 * Math.PI * segment.freq * i) / sampleRate) * 6000 * fade);
        buffer.writeInt16LE(value, offset);
        offset += 2;
      }
      offset += gapSamples * 2; // silêncio entre falas (Buffer.alloc já zera)
    }

    return { audio: buffer, mimeType: 'audio/wav', durationSec: Math.round(totalSamples / sampleRate) };
  }

  async generateIllustration(input: IllustrationInput): Promise<IllustrationOutput> {
    const seed = fnv1a(input.chapterTitle + input.seedText);
    const colors = Object.values(input.palette);
    const bg = colors[0] ?? '#0f172a';
    const accent = (i: number) => colors[(seed + i) % Math.max(colors.length, 1)] ?? '#38bdf8';

    const shapes = Array.from({ length: 5 }, (_, i) => {
      const s = fnv1a(`${seed}-${i}`);
      const cx = 60 + (s % 520);
      const cy = 50 + ((s >>> 8) % 220);
      const r = 18 + ((s >>> 16) % 46);
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent(i)}" opacity="0.${5 + (s % 4)}" />`;
    }).join('\n  ');

    const title = input.chapterTitle.replace(/[<>&"]/g, '');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320" role="img" aria-label="${title}">\n` +
      `  <rect width="640" height="320" fill="${bg}" />\n` +
      `  ${shapes}\n` +
      `  <text x="32" y="288" font-family="system-ui, sans-serif" font-size="26" font-weight="700" fill="#ffffff" opacity="0.92">${title}</text>\n` +
      `</svg>\n`;

    return {
      svg,
      alt: `Ilustração abstrata do capítulo "${input.chapterTitle}" nas cores do tema`,
      prompt: `Ilustração abstrata estilo-consistente para o capítulo "${input.chapterTitle}" usando a paleta do tema`,
    };
  }
}
