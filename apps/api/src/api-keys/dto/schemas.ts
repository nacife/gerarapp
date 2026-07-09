import { z } from 'zod';
import { API_KEY_SCOPES } from '../domain/scopes';

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(120),
  environment: z.enum(['live', 'test']).default('live'),
  projectId: z.string().uuid().nullish(),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, 'Selecione ao menos um escopo.'),
});
export type CreateApiKeyDto = z.infer<typeof createApiKeySchema>;
