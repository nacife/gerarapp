import { describe, expect, it } from 'vitest';
import { validateInteraction } from '@eduforge/schemas';
import { MockAiProvider } from './mock';
import { createAiProvider } from './factory';

const BLOCK = { id: '11111111-1111-1111-1111-111111111111', kind: 'concept', contentMd: 'A célula.' };

describe('MockAiProvider.generateInteractions', () => {
  const provider = new MockAiProvider();

  it('densidade "balanced" gera 2..4 interações, todas válidas', async () => {
    const out = await provider.generateInteractions({ block: BLOCK, density: 'balanced' });
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.length).toBeLessThanOrEqual(4);
    for (const it of out) {
      expect(validateInteraction(it.payload).ok, JSON.stringify(it.payload)).toBe(true);
    }
  });

  it('regenerateInteraction produz payload válido do tipo pedido', async () => {
    const one = await provider.regenerateInteraction({ block: BLOCK, type: 'quiz' });
    expect(one.type).toBe('quiz');
    expect(validateInteraction(one.payload).ok).toBe(true);
  });
});

describe('MockAiProvider', () => {
  const provider = new MockAiProvider();
  const input = { rawText: 'A célula é a unidade da vida.', filename: 'biologia.pdf' };

  it('é determinístico: mesma entrada → mesma árvore', async () => {
    const a = await provider.structureContent(input);
    const b = await provider.structureContent(input);
    expect(a).toEqual(b);
  });

  it('gera capítulos com seções e confiança dentro de 0..1', async () => {
    const { tree } = await provider.structureContent(input);
    expect(tree.length).toBeGreaterThanOrEqual(3);
    for (const chapter of tree) {
      expect(chapter.kind).toBe('chapter');
      expect(chapter.confidence).toBeGreaterThan(0);
      expect(chapter.confidence).toBeLessThanOrEqual(1);
      expect(chapter.children?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('MockAiProvider.generateMemorial', () => {
  const provider = new MockAiProvider();

  it('produz os 4 campos do memorial, citando título, capítulos e tipos de interação', async () => {
    const out = await provider.generateMemorial({
      title: 'Biologia Viva',
      slug: 'biologia-viva',
      versionNumber: 3,
      templateKey: 'moderno',
      chapterTitles: ['A Célula', 'Genética'],
      interactionTypes: ['quiz', 'flashcard_deck'],
    });
    expect(out.functionalDescription).toContain('Biologia Viva');
    expect(out.functionalDescription).toContain('A Célula');
    expect(out.functionalDescription).toContain('questionários');
    expect(out.architectureDescription).toContain('moderno');
    expect(out.applicationField.length).toBeGreaterThan(0);
    expect(out.programType.length).toBeGreaterThan(0);
  });
});

describe('createAiProvider', () => {
  it('retorna o mock', () => {
    expect(createAiProvider({ provider: 'mock' }).name).toBe('mock');
  });

  it('exige ANTHROPIC_API_KEY para provider anthropic', () => {
    expect(() => createAiProvider({ provider: 'anthropic' })).toThrowError(/ANTHROPIC_API_KEY/);
  });
});

describe('MockAiProvider.embedTexts (M10 — RAG do Sensei)', () => {
  const provider = new MockAiProvider();

  it('emite vetores de 1536 dims L2-normalizados e determinísticos', async () => {
    const [a, b] = await provider.embedTexts(['A fotossíntese converte luz em energia.', 'A fotossíntese converte luz em energia.']);
    expect(a).toHaveLength(1536);
    expect(a).toEqual(b);
    const norm = Math.sqrt(a!.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('textos com vocabulário em comum têm cosseno maior que textos sem relação', async () => {
    const [pergunta, relacionado, aleatorio] = await provider.embedTexts([
      'O que é fotossíntese e onde acontece?',
      'A fotossíntese acontece nos cloroplastos e converte luz, água e CO2 em glicose.',
      'O mercado financeiro fechou em alta com os juros futuros em queda.',
    ]);
    const cos = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i]!, 0);
    expect(cos(pergunta!, relacionado!)).toBeGreaterThan(cos(pergunta!, aleatorio!));
    expect(cos(pergunta!, relacionado!)).toBeGreaterThan(0.1);
  });

  it('acentos não mudam o token (fotossíntese ≈ fotossintese)', async () => {
    const [com, sem] = await provider.embedTexts(['fotossíntese', 'fotossintese']);
    expect(com).toEqual(sem);
  });
});

describe('MockAiProvider.tutorAnswer (M10 — RF-06.1)', () => {
  const provider = new MockAiProvider();
  const chunks = [
    { blockId: 'b1', contentMd: '## Fase clara\nA fase clara acontece nos tilacoides e produz ATP.', sourceRef: { page: 12 }, similarity: 0.8 },
    { blockId: 'b2', contentMd: 'O ciclo de Calvin fixa carbono no estroma.', sourceRef: { page: 14 }, similarity: 0.6 },
  ];

  it('responde com citações dos chunks usados', async () => {
    const out = await provider.tutorAnswer({ question: 'Onde acontece a fase clara?', mode: 'default', tone: 'formal', tutorName: 'Sensei', chunks });
    expect(out.refused).toBe(false);
    expect(out.citations.length).toBeGreaterThanOrEqual(1);
    expect(out.citations[0]?.blockId).toBe('b1');
    expect(out.answer).toContain('tilacoides');
  });

  it('sem contexto recuperado → recusa (fora de escopo), sem citações', async () => {
    const out = await provider.tutorAnswer({ question: 'Qual a capital da Mongólia?', mode: 'default', tone: 'descontraido', tutorName: 'Sensei', chunks: [] });
    expect(out.refused).toBe(true);
    expect(out.citations).toHaveLength(0);
  });

  it('modos variam a forma: test_me pergunta, socratic devolve perguntas-guia', async () => {
    const teste = await provider.tutorAnswer({ question: 'x', mode: 'test_me', tone: 'formal', tutorName: 'S', chunks });
    const socratico = await provider.tutorAnswer({ question: 'x', mode: 'socratic', tone: 'formal', tutorName: 'S', chunks });
    expect(teste.answer).toContain('Pergunta 1');
    expect(socratico.answer).toContain('?');
    expect(teste.answer).not.toEqual(socratico.answer);
  });
});

describe('MockAiProvider.generatePodcastScript / synthesizeSpeech (M10 — RF-06.5)', () => {
  const provider = new MockAiProvider();

  it('roteiro alterna apresentadores e cobre as seções', async () => {
    const script = await provider.generatePodcastScript({
      appTitle: 'Biologia Viva',
      chapterTitle: 'A Célula',
      sections: [
        { title: 'Membrana', contentMd: 'A membrana regula trocas.' },
        { title: 'Núcleo', contentMd: 'O núcleo guarda o DNA.' },
      ],
    });
    expect(script.title).toContain('A Célula');
    expect(script.lines.some((l) => l.speaker === 'A')).toBe(true);
    expect(script.lines.some((l) => l.speaker === 'B')).toBe(true);
    expect(script.lines.some((l) => l.text.includes('Membrana'))).toBe(true);
    expect(script.lines.some((l) => l.text.includes('Núcleo'))).toBe(true);
  });

  it('síntese produz WAV válido e tocável com duração > 0', async () => {
    const out = await provider.synthesizeSpeech({ lines: [{ speaker: 'A', text: 'Olá, bem-vindos ao episódio de hoje!' }] });
    expect(out.mimeType).toBe('audio/wav');
    expect(out.audio.subarray(0, 4).toString()).toBe('RIFF');
    expect(out.audio.subarray(8, 12).toString()).toBe('WAVE');
    expect(out.durationSec).toBeGreaterThan(0);
    // tamanho declarado no header bate com o buffer
    expect(out.audio.readUInt32LE(4)).toBe(out.audio.length - 8);
  });
});

describe('MockAiProvider.generateIllustration (M10 — imagens IA)', () => {
  const provider = new MockAiProvider();
  const input = {
    chapterTitle: 'A Célula',
    palette: { bg: '#0f172a', primary: '#38bdf8', accent: '#f472b6' },
    seedText: 'membrana núcleo organelas',
  };

  it('gera SVG determinístico com as cores da paleta e alt/prompt preenchidos', async () => {
    const a = await provider.generateIllustration(input);
    const b = await provider.generateIllustration(input);
    expect(a.svg).toEqual(b.svg);
    expect(a.svg).toContain('<svg');
    expect(a.svg).toContain('#0f172a');
    expect(a.svg).toContain('A Célula');
    expect(a.alt).toContain('A Célula');
    expect(a.prompt.length).toBeGreaterThan(10);
  });

  it('escapa caracteres perigosos do título no SVG', async () => {
    const out = await provider.generateIllustration({ ...input, chapterTitle: 'X <script> & "Y"' });
    expect(out.svg).not.toContain('<script>');
  });
});
