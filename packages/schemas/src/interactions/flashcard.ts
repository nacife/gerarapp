import { z } from 'zod';
import { envelopeSchema } from './envelope';

export const flashcardDeckSchema = envelopeSchema.extend({
  type: z.literal('flashcard_deck'),
  cards: z
    .array(
      z.object({
        id: z.string().regex(/^card_[a-z0-9]{6}$/),
        front_md: z.string().min(1).max(300),
        back_md: z.string().min(1).max(600),
        media_asset_id: z.string().uuid().optional(),
        hint_md: z.string().max(200).optional(),
      }),
    )
    .min(3)
    .max(40),
  srs: z
    .object({
      algorithm: z.literal('sm2'),
      initial_interval_days: z.number().int().default(1),
    })
    .optional(),
});
export type FlashcardDeck = z.infer<typeof flashcardDeckSchema>;

/** Regras semânticas do baralho (Parte 6.A.4). */
export function flashcardDeckSemantic(p: FlashcardDeck): string[] {
  const ids = p.cards.map((c) => c.id);
  return new Set(ids).size !== ids.length ? ['há ids de card duplicados.'] : [];
}
