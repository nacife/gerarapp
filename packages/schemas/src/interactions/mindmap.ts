import { z } from 'zod';
import { envelopeSchema } from './envelope';

export const mindmapSchema = envelopeSchema.extend({
  type: z.literal('mindmap'),
  root_id: z.string().min(1),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        label_md: z.string().max(80),
        detail_md: z.string().max(400).optional(),
        content_block_id: z.string().uuid().optional(),
      }),
    )
    .min(3)
    .max(60),
  edges: z.array(
    z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      relation_md: z.string().max(60).optional(),
    }),
  ),
});
export type Mindmap = z.infer<typeof mindmapSchema>;

/** Regras semânticas (Parte 6.A.10): root e arestas resolvíveis, ids únicos. */
export function mindmapSemantic(p: Mindmap): string[] {
  const errors: string[] = [];
  const ids = new Set(p.nodes.map((n) => n.id));
  if (ids.size !== p.nodes.length) errors.push('há ids de nó duplicados.');
  if (!ids.has(p.root_id)) errors.push('root_id não existe entre os nós.');
  for (const e of p.edges) {
    if (!ids.has(e.from)) errors.push(`aresta from "${e.from}" não resolve.`);
    if (!ids.has(e.to)) errors.push(`aresta to "${e.to}" não resolve.`);
  }
  return errors;
}
