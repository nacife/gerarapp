import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './builder';
import { PUBLIC_API_ROUTES } from './registry';

const doc = buildOpenApiDocument(PUBLIC_API_ROUTES, '1.0.0') as {
  openapi: string;
  servers: { url: string }[];
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components: {
    securitySchemes: Record<string, unknown>;
    parameters: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
};

describe('buildOpenApiDocument', () => {
  it('declara OpenAPI 3.1 servido sob /v1', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers[0]?.url).toBe('/v1');
  });

  it('cobre o fluxo B.3 completo (upload → publicação)', () => {
    expect(doc.paths['/projects']?.post).toBeDefined();
    expect(doc.paths['/projects/{id}/source-files']?.post).toBeDefined();
    expect(doc.paths['/source-files/{id}/ingest']?.post).toBeDefined();
    expect(doc.paths['/jobs/{id}']?.get).toBeDefined();
    expect(doc.paths['/projects/{id}/content-map/approve']?.post).toBeDefined();
    expect(doc.paths['/projects/{id}/interactions/generate']?.post).toBeDefined();
    expect(doc.paths['/projects/{id}/theme']?.put).toBeDefined();
    expect(doc.paths['/projects/{id}/publish']?.post).toBeDefined();
  });

  it('request bodies vêm dos Zod DTOs (ex.: POST /projects exige title)', () => {
    const body = doc.paths['/projects']!.post!.requestBody as {
      content: { 'application/json': { schema: { properties: Record<string, unknown>; required?: string[] } } };
    };
    const schema = body.content['application/json'].schema;
    expect(schema.properties.title).toBeDefined();
    expect(schema.required).toContain('title');
  });

  it('nenhum schema carrega a chave $schema (JSON Schema puro para 3.1)', () => {
    expect(JSON.stringify(doc)).not.toContain('"$schema"');
  });

  it('/publish exige Idempotency-Key e o escopo publish', () => {
    const op = doc.paths['/projects/{id}/publish']!.post!;
    const params = op.parameters as { $ref?: string }[];
    expect(params.some((p) => p.$ref === '#/components/parameters/IdempotencyKey')).toBe(true);
    expect(op['x-required-scope']).toBe('publish');
  });

  it('rotas de criador aceitam API key (bearer) e sessão; rotas públicas não exigem auth', () => {
    expect(doc.paths['/projects']!.post!.security).toEqual([{ apiKey: [] }, { session: [] }]);
    expect(doc.paths['/public/apps/{slug}']!.get!.security).toEqual([]);
    expect(doc.components.securitySchemes.apiKey).toBeDefined();
  });

  it('parâmetros de caminho são derivados do template ({id} → uuid, {slug} → string)', () => {
    const op = doc.paths['/public/apps/{slug}']!.get!;
    const params = op.parameters as { name: string; in: string; schema: { format?: string } }[];
    const slug = params.find((p) => p.name === 'slug');
    expect(slug?.in).toBe('path');
    expect(slug?.schema.format).toBeUndefined();

    const idOp = doc.paths['/projects/{id}']!.get!;
    const idParam = (idOp.parameters as { name: string; schema: { format?: string } }[]).find((p) => p.name === 'id');
    expect(idParam?.schema.format).toBe('uuid');
  });

  it('query params vêm do Zod (analytics: from/to opcionais)', () => {
    const op = doc.paths['/projects/{id}/analytics/summary']!.get!;
    const params = op.parameters as { name: string; in: string; required: boolean }[];
    const from = params.find((p) => p.name === 'from');
    expect(from?.in).toBe('query');
    expect(from?.required).toBe(false);
  });

  it('toda operação tem resposta default de Problem Details', () => {
    for (const [, methods] of Object.entries(doc.paths)) {
      for (const [, op] of Object.entries(methods)) {
        const responses = (op as { responses: Record<string, unknown> }).responses;
        expect(responses.default).toBeDefined();
      }
    }
    expect(doc.components.schemas.ProblemDetails).toBeDefined();
  });

  it('não há operationIds duplicados', () => {
    const ids: string[] = [];
    for (const methods of Object.values(doc.paths)) {
      for (const op of Object.values(methods)) {
        ids.push((op as { operationId: string }).operationId);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
