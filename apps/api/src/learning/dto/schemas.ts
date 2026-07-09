import { z } from 'zod';

export const learnerSignupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(1),
});
export type LearnerSignupDto = z.infer<typeof learnerSignupSchema>;

export const learnerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LearnerLoginDto = z.infer<typeof learnerLoginSchema>;

export const enrollSchema = z.object({
  accessKey: z.string().max(200).optional(),
});
export type EnrollDto = z.infer<typeof enrollSchema>;

export const recordEventSchema = z.object({
  event: z.enum(['view', 'answer', 'complete']),
  interactionId: z.string().uuid().optional(),
  detail: z.record(z.unknown()).optional(),
});
export type RecordEventDto = z.infer<typeof recordEventSchema>;

export const inviteSchema = z.object({ email: z.string().email() });
export type InviteDto = z.infer<typeof inviteSchema>;
