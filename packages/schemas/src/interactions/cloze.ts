import { z } from 'zod';
import { envelopeSchema } from './envelope';

export const clozeSchema = envelopeSchema.extend({
  type: z.literal('cloze'),
  text_template_md: z.string().min(1).max(1200),
  gaps: z
    .array(
      z.object({
        id: z.string().regex(/^g[0-9]{1,2}$/),
        answers: z.array(z.string().min(1).max(60)).min(1),
        case_sensitive: z.boolean().default(false),
        input: z.enum(['typed', 'word_bank']).default('word_bank'),
      }),
    )
    .min(1)
    .max(8),
  word_bank_distractors: z.array(z.string().max(60)).max(6).optional(),
});
export type Cloze = z.infer<typeof clozeSchema>;

/** Regra semântica: paridade entre marcadores {{gap:*}} e gaps (Parte 6.A.5). */
export function clozeSemantic(p: Cloze): string[] {
  const errors: string[] = [];
  const markers = [...p.text_template_md.matchAll(/\{\{gap:([a-z0-9]+)\}\}/gi)].map((m) => m[1]);
  const markerSet = new Set(markers);
  const gapIds = new Set(p.gaps.map((g) => g.id));

  for (const id of gapIds) {
    if (!markerSet.has(id)) errors.push(`gap "${id}" não tem marcador correspondente no texto.`);
  }
  for (const m of markerSet) {
    if (m && !gapIds.has(m)) errors.push(`marcador "{{gap:${m}}}" não tem gap correspondente.`);
  }
  return errors;
}
