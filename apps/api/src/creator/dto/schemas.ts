import { z } from 'zod';

export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type DateRangeDto = z.infer<typeof dateRangeSchema>;

export function resolveRange(dto: DateRangeDto): { from: Date; to: Date } {
  const to = dto.to ? new Date(dto.to) : new Date();
  const from = dto.from ? new Date(dto.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}
