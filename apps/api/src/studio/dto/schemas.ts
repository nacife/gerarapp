import { z } from 'zod';

const colors = z.record(z.string());

export const setThemeSchema = z.object({
  template: z.string().min(1),
  palette: z.object({ light: colors, dark: colors }),
  typography: z.record(z.unknown()).default({}),
  effects: z.record(z.unknown()).default({}),
});
export type SetThemeDto = z.infer<typeof setThemeSchema>;

export const fromLogoSchema = z.object({
  brand: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'cor hex #RRGGBB'),
});
export type FromLogoDto = z.infer<typeof fromLogoSchema>;

export const setAccessSchema = z.object({
  mode: z.enum(['public', 'link', 'password', 'invite']),
  password: z.string().min(4).max(100).optional(),
});
export type SetAccessDto = z.infer<typeof setAccessSchema>;

export const rollbackSchema = z.object({
  versionNumber: z.number().int().positive(),
});
export type RollbackDto = z.infer<typeof rollbackSchema>;
