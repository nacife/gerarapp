import { z } from 'zod';

/** Classificação semântica de um bloco (RF-01). Espelha o enum do banco. */
export const CONTENT_BLOCK_KINDS = [
  'concept',
  'definition',
  'example',
  'exercise',
  'summary',
  'figure',
  'table',
  'formula',
] as const;
export const contentBlockKindSchema = z.enum(CONTENT_BLOCK_KINDS);
export type ContentBlockKind = z.infer<typeof contentBlockKindSchema>;

/** Nó do Mapa de Conteúdo (capítulo → seções). Árvore editável (US-ING-02). */
export interface MapNode {
  id: string;
  title: string;
  confidence: number;
  kind?: ContentBlockKind;
  excerpt?: string;
  blockId?: string;
  children?: MapNode[];
}

export const mapNodeSchema: z.ZodType<MapNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    title: z.string().min(1).max(200),
    confidence: z.number().min(0).max(1),
    kind: contentBlockKindSchema.optional(),
    excerpt: z.string().max(600).optional(),
    blockId: z.string().uuid().optional(),
    children: z.array(mapNodeSchema).optional(),
  }),
);

export const contentMapTreeSchema = z.object({
  chapters: z.array(mapNodeSchema).min(1).max(200),
});
export type ContentMapTree = z.infer<typeof contentMapTreeSchema>;

/** Limiar de confiança abaixo do qual um bloco é destacado (US-ING-02). */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Coleta todos os `blockId` (folhas com conteúdo) de uma árvore do mapa. */
export function collectBlockIds(tree: ContentMapTree): string[] {
  const ids: string[] = [];
  const walk = (nodes: MapNode[]) => {
    for (const node of nodes) {
      if (node.blockId) ids.push(node.blockId);
      if (node.children) walk(node.children);
    }
  };
  walk(tree.chapters);
  return ids;
}
