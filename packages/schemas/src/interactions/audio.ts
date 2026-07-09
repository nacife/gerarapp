import { z } from 'zod';
import { envelopeSchema } from './envelope';

export const audioSchema = envelopeSchema.extend({
  type: z.literal('audio'),
  variant: z.enum(['summary', 'podcast']),
  media_asset_id: z.string().uuid(),
  duration_s: z.number().int().min(30).max(1800).optional(),
  transcript: z.array(
    z.object({
      t_ms: z.number().int().min(0),
      speaker: z.enum(['narrator', 'host_a', 'host_b']),
      text: z.string().max(500),
    }),
  ),
});
export type Audio = z.infer<typeof audioSchema>;

/** Regras semânticas (Parte 6.A.10): tempos crescentes + coerência de locutor. */
export function audioSemantic(p: Audio): string[] {
  const errors: string[] = [];
  for (let i = 1; i < p.transcript.length; i++) {
    if (p.transcript[i].t_ms < p.transcript[i - 1].t_ms) {
      errors.push('transcript: t_ms deve ser não-decrescente.');
      break;
    }
  }
  const speakers = new Set(p.transcript.map((t) => t.speaker));
  if (p.variant === 'summary' && (speakers.has('host_a') || speakers.has('host_b')))
    errors.push('variant "summary" usa apenas "narrator".');
  if (p.variant === 'podcast' && speakers.has('narrator'))
    errors.push('variant "podcast" usa "host_a"/"host_b", não "narrator".');
  return errors;
}
