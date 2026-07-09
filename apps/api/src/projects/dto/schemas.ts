import { z } from 'zod';
import { contentMapTreeSchema } from '@eduforge/schemas';

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  locale: z.string().max(10).optional(),
});
export type CreateProjectDto = z.infer<typeof createProjectSchema>;

export const initiateUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().max(150).optional(),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/, 'SHA-256 hexadecimal de 64 caracteres'),
});
export type InitiateUploadDto = z.infer<typeof initiateUploadSchema>;

export const updateContentMapSchema = z.object({ tree: contentMapTreeSchema });
export type UpdateContentMapDto = z.infer<typeof updateContentMapSchema>;
