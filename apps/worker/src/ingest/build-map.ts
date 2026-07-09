import { randomUUID } from 'node:crypto';
import type { StructureContentOutput } from '@eduforge/ai';
import type { ContentBlockKind, ContentMapTree, MapNode } from '@eduforge/schemas';

export interface BuiltBlock {
  id: string;
  kind: ContentBlockKind;
  contentMd: string;
  confidence: number;
  sourceRef: { charStart: number; charEnd: number };
}

export interface BuiltContentMap {
  tree: ContentMapTree;
  blocks: BuiltBlock[];
  structureConfidence: number;
}

/** Classificação semântica heurística e determinística (RF-01). */
export function classifyKind(title: string, text: string): ContentBlockKind {
  const s = `${title} ${text.slice(0, 400)}`.toLowerCase();
  if (/\bexemplo\b|por exemplo/.test(s)) return 'example';
  if (/exerc[íi]cio|responda|calcule|quest[ãa]o/.test(s)) return 'exercise';
  if (/resumo|conclus[ãa]o|em s[íi]ntese/.test(s)) return 'summary';
  if (/defini[çc][ãa]o|denomina|chama-se|conceito de/.test(s)) return 'definition';
  if (/\btabela\b/.test(s)) return 'table';
  if (/figura|diagrama|ilustra[çc]/.test(s)) return 'figure';
  return 'concept';
}

/**
 * Constrói o Mapa de Conteúdo (árvore + blocos) a partir da estruturação da IA
 * e do texto extraído, fatiando o texto por seção e classificando cada bloco.
 */
export function buildContentMap(
  structured: StructureContentOutput,
  fullText: string,
): BuiltContentMap {
  const totalSections = Math.max(
    structured.tree.reduce((n, ch) => n + (ch.children?.length ?? 0), 0),
    1,
  );
  const chunkSize = Math.ceil(Math.max(fullText.length, 1) / totalSections);

  const blocks: BuiltBlock[] = [];
  const confidences: number[] = [];
  let sectionIndex = 0;

  const chapters: MapNode[] = structured.tree.map((chapter) => {
    confidences.push(chapter.confidence);
    const children: MapNode[] = (chapter.children ?? []).map((section) => {
      const start = sectionIndex * chunkSize;
      const chunk = fullText.slice(start, start + chunkSize).trim();
      sectionIndex += 1;
      confidences.push(section.confidence);

      const kind = classifyKind(section.title, chunk);
      const blockId = randomUUID();
      blocks.push({
        id: blockId,
        kind,
        contentMd: (chunk || section.title).slice(0, 8000),
        confidence: section.confidence,
        sourceRef: { charStart: start, charEnd: start + chunk.length },
      });

      return {
        id: `sec-${blockId.slice(0, 8)}`,
        title: section.title,
        confidence: Math.round(section.confidence * 100) / 100,
        kind,
        blockId,
        excerpt: chunk.slice(0, 200) || undefined,
      };
    });
    return {
      id: `ch-${randomUUID().slice(0, 8)}`,
      title: chapter.title,
      confidence: Math.round(chapter.confidence * 100) / 100,
      children,
    };
  });

  const structureConfidence = confidences.length
    ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
    : 0;

  return { tree: { chapters }, blocks, structureConfidence };
}
