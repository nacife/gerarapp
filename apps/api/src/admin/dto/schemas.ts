import { z } from 'zod';

export const suspendSchema = z.object({ reason: z.string().min(1).max(500) });
export type SuspendDto = z.infer<typeof suspendSchema>;

export const grantCreditsSchema = z.object({
  delta: z.number().int().refine((n) => n !== 0, 'delta não pode ser zero'),
  reason: z.string().min(1).max(200),
});
export type GrantCreditsDto = z.infer<typeof grantCreditsSchema>;

export const searchUsersSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.enum(['active', 'suspended', 'pending_deletion']).optional(),
});
export type SearchUsersDto = z.infer<typeof searchUsersSchema>;

export const createFlagSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'use snake_case (a-z, 0-9, _)'),
  defaultOn: z.boolean().default(false),
  rolloutPct: z.number().int().min(0).max(100).default(0),
});
export type CreateFlagDto = z.infer<typeof createFlagSchema>;

export const updateFlagSchema = z.object({
  defaultOn: z.boolean().optional(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
});
export type UpdateFlagDto = z.infer<typeof updateFlagSchema>;

export const pinFlagSchema = z.object({
  subjectType: z.enum(['user', 'org', 'plan']),
  subjectId: z.string().uuid(),
  enabled: z.boolean(),
});
export type PinFlagDto = z.infer<typeof pinFlagSchema>;

export const impersonateConsumeSchema = z.object({ token: z.string().min(1) });
export type ImpersonateConsumeDto = z.infer<typeof impersonateConsumeSchema>;
