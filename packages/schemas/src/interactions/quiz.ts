import { z } from 'zod';
import { envelopeSchema } from './envelope';

export const quizSchema = envelopeSchema.extend({
  type: z.literal('quiz'),
  question_md: z.string().min(10).max(600),
  mode: z.enum(['single', 'multiple', 'true_false']),
  options: z
    .array(
      z.object({
        id: z.string().regex(/^opt_[a-z0-9]{6}$/),
        text_md: z.string().min(1).max(300),
        correct: z.boolean(),
        rationale_md: z.string().max(400).optional(),
      }),
    )
    .min(2)
    .max(6),
  feedback: z.object({
    correct_md: z.string().max(500),
    incorrect_md: z.string().max(500),
  }),
  shuffle_options: z.boolean().default(true),
  time_limit_s: z.number().int().min(10).max(300).optional(),
});
export type Quiz = z.infer<typeof quizSchema>;

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Regras semânticas do quiz (Parte 6.A.3). */
export function quizSemantic(p: Quiz): string[] {
  const errors: string[] = [];
  const correct = p.options.filter((o) => o.correct).length;
  if (p.mode === 'single' && correct !== 1)
    errors.push('quiz "single" exige exatamente 1 alternativa correta.');
  if (p.mode === 'multiple' && correct < 2)
    errors.push('quiz "multiple" exige ao menos 2 alternativas corretas.');
  if (p.mode === 'true_false' && p.options.length !== 2)
    errors.push('quiz "true_false" exige exatamente 2 opções.');

  const texts = p.options.map((o) => normalize(o.text_md));
  if (new Set(texts).size !== texts.length) errors.push('há opções duplicadas (texto).');
  const ids = p.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) errors.push('há ids de opção duplicados.');
  return errors;
}
