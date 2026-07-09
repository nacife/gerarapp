import { z } from 'zod';
import { envelopeSchema } from './envelope';

export const timelineSchema = envelopeSchema.extend({
  type: z.literal('timeline'),
  title_md: z.string().max(200),
  axis: z.enum(['date', 'sequence']).default('sequence'),
  events: z
    .array(
      z.object({
        id: z.string().min(1),
        label_md: z.string().max(120),
        detail_md: z.string().max(500),
        date: z.string().optional(),
        order: z.number().int().optional(),
        media_asset_id: z.string().uuid().optional(),
      }),
    )
    .min(3)
    .max(20),
  quiz_mode: z.boolean().default(false),
});
export type Timeline = z.infer<typeof timelineSchema>;

/** Regra semântica: axis=date exige date em todos os eventos (Parte 6.A.7). */
export function timelineSemantic(p: Timeline): string[] {
  const errors: string[] = [];
  if (p.axis === 'date' && p.events.some((e) => !e.date))
    errors.push('axis=date: todo evento precisa de "date".');
  const ids = p.events.map((e) => e.id);
  if (new Set(ids).size !== ids.length) errors.push('há ids de evento duplicados.');
  return errors;
}
