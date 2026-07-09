import { z } from 'zod';

export const senseiConfigSchema = z.object({
  name: z.string().min(1).max(40),
  avatar: z.string().min(1).max(8), // emoji (1–2 code points compostos)
  tone: z.enum(['formal', 'descontraido', 'motivador']),
});
export type SenseiConfigDto = z.infer<typeof senseiConfigSchema>;

export const askSenseiSchema = z.object({
  question: z.string().min(3).max(500),
  mode: z.enum(['default', 'explain_different', 'test_me', 'socratic']).default('default'),
});
export type AskSenseiDto = z.infer<typeof askSenseiSchema>;
