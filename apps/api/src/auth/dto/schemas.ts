import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().min(1).max(120),
  locale: z.string().max(10).optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar os termos (LGPD).' }),
  }),
});
export type SignupDto = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const loginMfaSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().min(4).max(20),
});
export type LoginMfaDto = z.infer<typeof loginMfaSchema>;

export const tokenSchema = z.object({ token: z.string().min(1) });
export type TokenDto = z.infer<typeof tokenSchema>;

export const emailSchema = z.object({ email: z.string().email() });
export type EmailDto = z.infer<typeof emailSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
});
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export const mfaCodeSchema = z.object({ code: z.string().min(4).max(20) });
export type MfaCodeDto = z.infer<typeof mfaCodeSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  locale: z.string().max(10).optional(),
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
