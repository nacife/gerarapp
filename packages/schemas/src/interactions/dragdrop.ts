import { z } from 'zod';
import { envelopeSchema } from './envelope';

export const dragdropSchema = envelopeSchema.extend({
  type: z.literal('dragdrop'),
  variant: z.enum(['ordering', 'matching', 'categorize']),
  prompt_md: z.string().max(400),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        label_md: z.string().max(200),
        correct_position: z.number().int().optional(),
        match_target_id: z.string().optional(),
        category_id: z.string().optional(),
      }),
    )
    .min(2)
    .max(12),
  targets: z
    .array(z.object({ id: z.string().min(1), label_md: z.string().max(200) }))
    .max(12)
    .optional(),
  partial_credit: z.boolean().default(true),
});
export type Dragdrop = z.infer<typeof dragdropSchema>;

/** Regras semânticas por variante (Parte 6.A.6). */
export function dragdropSemantic(p: Dragdrop): string[] {
  const errors: string[] = [];
  if (p.variant === 'ordering') {
    const positions = p.items.map((i) => i.correct_position);
    if (positions.some((pos) => pos == null)) {
      errors.push('ordering: todo item precisa de correct_position.');
    } else {
      const sorted = [...(positions as number[])].sort((a, b) => a - b);
      const expected = p.items.map((_, i) => i + 1);
      if (sorted.join(',') !== expected.join(','))
        errors.push('ordering: posições devem ser únicas e contíguas 1..N.');
    }
  } else {
    const targetIds = new Set((p.targets ?? []).map((t) => t.id));
    if (targetIds.size === 0) errors.push(`${p.variant}: exige "targets" (alvos/categorias).`);
    for (const item of p.items) {
      const ref = p.variant === 'matching' ? item.match_target_id : item.category_id;
      if (!ref) errors.push(`${p.variant}: item "${item.id}" sem referência de alvo.`);
      else if (!targetIds.has(ref)) errors.push(`${p.variant}: referência "${ref}" não resolve.`);
    }
  }
  return errors;
}
