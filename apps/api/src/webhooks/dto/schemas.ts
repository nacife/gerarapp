import { WEBHOOK_EVENT_TYPES } from '@eduforge/schemas';
import { z } from 'zod';

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1, 'Selecione ao menos um evento.'),
  secret: z.string().min(16, 'O segredo deve ter ao menos 16 caracteres.'),
  projectId: z.string().uuid().nullish(),
});
export type CreateWebhookDto = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
  active: z.boolean().optional(),
});
export type UpdateWebhookDto = z.infer<typeof updateWebhookSchema>;
