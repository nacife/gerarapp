import { z } from 'zod';
import { envelopeSchema } from './envelope';

export const scenarioSchema = envelopeSchema.extend({
  type: z.literal('scenario'),
  title_md: z.string().max(200),
  start_node_id: z.string().min(1),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(['situation', 'outcome']),
        text_md: z.string().max(800),
        choices: z
          .array(
            z.object({
              label_md: z.string().max(200),
              next_node_id: z.string().min(1),
              quality: z.enum(['best', 'acceptable', 'poor']).optional(),
            }),
          )
          .min(2)
          .max(4)
          .optional(),
        outcome_score: z.number().int().min(0).max(100).optional(),
      }),
    )
    .min(3)
    .max(30),
});
export type Scenario = z.infer<typeof scenarioSchema>;

/**
 * Regras semânticas (Parte 6.A.9): grafo acíclico, next_node_id resolvível,
 * todo caminho termina em outcome, e existe ≥1 escolha "best" alcançável.
 */
export function scenarioSemantic(p: Scenario): string[] {
  const errors: string[] = [];
  const nodes = new Map(p.nodes.map((n) => [n.id, n]));

  if (!nodes.has(p.start_node_id)) errors.push('start_node_id não existe entre os nós.');

  for (const n of p.nodes) {
    if (n.kind === 'situation') {
      if (!n.choices || n.choices.length < 2)
        errors.push(`nó "${n.id}" (situation) exige ao menos 2 escolhas.`);
      for (const c of n.choices ?? []) {
        if (!nodes.has(c.next_node_id))
          errors.push(`nó "${n.id}": destino "${c.next_node_id}" não resolve.`);
      }
    } else if (n.choices && n.choices.length > 0) {
      errors.push(`nó "${n.id}" (outcome) não pode ter escolhas.`);
    }
  }
  if (errors.length > 0) return errors;

  const visiting = new Set<string>();
  const done = new Set<string>();
  const reachable = new Set<string>();
  let cyclic = false;
  let hasBest = false;

  const dfs = (id: string): void => {
    if (visiting.has(id)) {
      cyclic = true;
      return;
    }
    if (done.has(id)) return;
    visiting.add(id);
    reachable.add(id);
    const node = nodes.get(id);
    if (node?.kind === 'situation') {
      for (const c of node.choices ?? []) {
        if (c.quality === 'best') hasBest = true;
        dfs(c.next_node_id);
      }
    }
    visiting.delete(id);
    done.add(id);
  };
  dfs(p.start_node_id);

  if (cyclic) errors.push('o grafo do cenário não pode conter ciclos.');
  if (!hasBest) errors.push('deve existir ao menos uma escolha "best" alcançável.');
  if (![...reachable].some((id) => nodes.get(id)?.kind === 'outcome'))
    errors.push('nenhum "outcome" é alcançável a partir do início.');

  return errors;
}
