import { z } from 'zod';
import { interactionTypeSchema } from '@eduforge/schemas';

export const generateSchema = z.object({
  density: z.enum(['light', 'balanced', 'intensive']).default('balanced'),
  types: z.array(interactionTypeSchema).optional(),
});
export type GenerateDto = z.infer<typeof generateSchema>;

export const editInteractionSchema = z.object({
  payload: z.record(z.unknown()),
});
export type EditInteractionDto = z.infer<typeof editInteractionSchema>;
