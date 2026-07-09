import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/decorators';
import { buildOpenApiDocument } from './builder';
import { PUBLIC_API_ROUTES } from './registry';

const API_VERSION = '1.0.0';

@Controller()
export class OpenApiController {
  // Construído uma única vez no boot: o registro é estático.
  private readonly document = buildOpenApiDocument(PUBLIC_API_ROUTES, API_VERSION);

  /** Documento público — mesmo padrão das rotas `@Public()` de auth/runtime. */
  @Public()
  @Get('openapi.json')
  @Header('cache-control', 'public, max-age=300')
  getDocument(): Record<string, unknown> {
    return this.document;
  }
}
