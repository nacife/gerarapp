import { z } from 'zod';
import { envelopeSchema } from './envelope';

export const hotspotSchema = envelopeSchema.extend({
  type: z.literal('hotspot'),
  media_asset_id: z.string().uuid(),
  image_alt: z.string().max(300).optional(),
  spots: z
    .array(
      z.object({
        id: z.string().min(1),
        shape: z.enum(['circle', 'rect', 'poly']),
        coords: z.array(z.number().min(0).max(1)),
        label_md: z.string().max(120),
        detail_md: z.string().max(500),
      }),
    )
    .min(1)
    .max(15),
  quiz_mode: z.boolean().default(false),
});
export type Hotspot = z.infer<typeof hotspotSchema>;

/** Regra semântica: coordenadas coerentes com a forma (Parte 6.A.8). */
export function hotspotSemantic(p: Hotspot): string[] {
  const errors: string[] = [];
  for (const s of p.spots) {
    if (s.shape === 'circle' && s.coords.length !== 3)
      errors.push(`spot "${s.id}": circle exige 3 coords [x,y,r].`);
    if (s.shape === 'rect' && s.coords.length !== 4)
      errors.push(`spot "${s.id}": rect exige 4 coords.`);
    if (s.shape === 'poly' && (s.coords.length < 6 || s.coords.length % 2 !== 0))
      errors.push(`spot "${s.id}": poly exige nº par ≥ 6 de coords.`);
  }
  const ids = p.spots.map((s) => s.id);
  if (new Set(ids).size !== ids.length) errors.push('há ids de spot duplicados.');
  return errors;
}
