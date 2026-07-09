import { z } from 'zod';

/**
 * Lista canônica dos 9 tipos de interação (PRD Parte 6.A.2).
 * Esta é a fonte única — o enum do banco (`InteractionType`) espelha esta lista.
 */
export const INTERACTION_TYPES = [
  'quiz',
  'flashcard_deck',
  'cloze',
  'dragdrop',
  'timeline',
  'hotspot',
  'scenario',
  'audio',
  'mindmap',
] as const;

export const interactionTypeSchema = z.enum(INTERACTION_TYPES);
export type InteractionType = z.infer<typeof interactionTypeSchema>;

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const difficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof difficultySchema>;

export const sourceRefSchema = z.object({
  content_block_id: z.string().uuid(),
  page_hint: z.number().int().min(1).optional(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const a11ySchema = z
  .object({
    alt_texts_complete: z.boolean().optional(),
    keyboard_operable: z.literal(true).optional(),
  })
  .optional();

/**
 * Envelope comum a todos os tipos de interação (PRD Parte 6.A.2).
 * Os payloads concretos (quiz, cloze, etc.) serão implementados na M3
 * fazendo `envelopeSchema.merge(...)` — TODO(prd:RF-02).
 */
export const envelopeSchema = z.object({
  schema_version: z.literal(1),
  type: interactionTypeSchema,
  source_ref: sourceRefSchema,
  difficulty: difficultySchema,
  objective: z.string().min(1).max(200),
  xp: z.number().int().min(5).max(100).default(10),
  a11y: a11ySchema,
});
export type Envelope = z.infer<typeof envelopeSchema>;
