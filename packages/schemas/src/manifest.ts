import { z } from 'zod';
import { contentMapTreeSchema } from './content-map';

export const accessModeSchema = z.enum(['public', 'link', 'password', 'invite']);

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  slug: z.string(),
  title: z.string(),
  version: z.number().int().positive(),
  publishedAt: z.string(),
  access: z.object({ mode: accessModeSchema }),
  theme: z.object({
    template: z.string(),
    tokens: z.record(z.unknown()),
    palette: z.object({
      light: z.record(z.string()),
      dark: z.record(z.string()),
    }),
    typography: z.record(z.unknown()),
    effects: z.record(z.unknown()),
  }),
  content: contentMapTreeSchema,
  interactions: z.array(
    z.object({
      id: z.string(),
      contentBlockId: z.string().nullable(),
      type: z.string(),
      payload: z.unknown(),
      difficulty: z.string(),
      position: z.number().int(),
    }),
  ),
});
export type Manifest = z.infer<typeof manifestSchema>;

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Serialização canônica determinística (chaves ordenadas, sem espaços) — base
 * do hash reprodutível do manifesto (RF-04; pré-requisito do pacote INPI, M7).
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}
