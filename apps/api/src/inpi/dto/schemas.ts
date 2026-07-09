import { z } from 'zod';

export const generatePackageSchema = z.object({
  versionNumber: z.number().int().positive().optional(),
});
export type GeneratePackageDto = z.infer<typeof generatePackageSchema>;
