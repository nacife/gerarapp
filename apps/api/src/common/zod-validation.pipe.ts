import type { PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/** Valida o valor recebido contra um schema Zod (§0.5.1). ZodError → filtro. */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
