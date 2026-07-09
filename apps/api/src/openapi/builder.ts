import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';
import type { RouteEntry } from './registry';

const API_DESCRIPTION =
  'API pública do EduForge (Parte 6.B). Autentique com `Authorization: Bearer <api_key>` ' +
  '(chaves `efk_live_`/`efk_test_`, criadas no painel do criador) ou com a sessão de cookie dos painéis. ' +
  'Erros seguem Problem Details (RFC 9457); rate limit padrão de 120 req/min por chave (headers `X-RateLimit-*`).';

// Sem o cast, o compilador do `nest --watch` estoura TS2589 (instanciação de
// tipo excessivamente profunda) nos generics do zod-to-json-schema com ZodTypeAny.
const toJson = zodToJsonSchema as unknown as (
  schema: ZodTypeAny,
  options: { $refStrategy: 'none' },
) => Record<string, unknown>;

/** Converte um Zod schema em JSON Schema puro (compatível com OpenAPI 3.1). */
function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const json = toJson(schema, { $refStrategy: 'none' });
  delete json.$schema;
  return json;
}

/** `{id}` → parâmetro de caminho; ids são UUID, slugs/códigos são strings simples. */
function pathParameters(path: string): Record<string, unknown>[] {
  const names = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
  return names.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema:
      name === 'slug' || name === 'code'
        ? { type: 'string' }
        : { type: 'string', format: 'uuid' },
  }));
}

function queryParameters(schema: ZodTypeAny): Record<string, unknown>[] {
  const json = toJsonSchema(schema);
  const properties = (json.properties ?? {}) as Record<string, unknown>;
  const required = new Set((json.required as string[] | undefined) ?? []);
  return Object.entries(properties).map(([name, propSchema]) => ({
    name,
    in: 'query',
    required: required.has(name),
    schema: propSchema,
  }));
}

function securityFor(entry: RouteEntry): Record<string, string[]>[] | undefined {
  switch (entry.auth) {
    case 'creator':
      return [{ apiKey: [] }, { session: [] }];
    case 'learner':
      return [{ learnerSession: [] }];
    case 'public':
      return [];
  }
}

/** Monta o documento OpenAPI 3.1 a partir do registro declarativo — puro e determinístico. */
export function buildOpenApiDocument(routes: RouteEntry[], version: string): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const entry of routes) {
    const operation: Record<string, unknown> = {
      summary: entry.summary,
      tags: [entry.tag],
      operationId: `${entry.method}_${entry.path.replace(/[/{}]+/g, '_').replace(/^_|_$/g, '')}`,
      security: securityFor(entry),
      responses: {
        [String(entry.successStatus ?? 200)]: {
          description: entry.successDescription ?? 'Sucesso',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        default: {
          description: 'Erro no formato Problem Details (RFC 9457) — códigos por domínio na Parte 6.B.5.',
          content: {
            'application/problem+json': {
              schema: { $ref: '#/components/schemas/ProblemDetails' },
            },
          },
        },
      },
    };

    if (entry.scope) {
      operation['x-required-scope'] = entry.scope;
      operation.description = `Escopo exigido com API key: \`${entry.scope}\`.`;
    }

    const parameters: Record<string, unknown>[] = pathParameters(entry.path);
    if (entry.querySchema) parameters.push(...queryParameters(entry.querySchema));
    if (entry.idempotencyKey) parameters.push({ $ref: '#/components/parameters/IdempotencyKey' });
    if (parameters.length > 0) operation.parameters = parameters;

    if (entry.requestSchema) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: toJsonSchema(entry.requestSchema) } },
      };
    }

    paths[entry.path] = { ...(paths[entry.path] ?? {}), [entry.method]: operation };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'EduForge API',
      version,
      description: API_DESCRIPTION,
    },
    servers: [{ url: '/v1' }],
    paths,
    components: {
      securitySchemes: {
        apiKey: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key do criador (`efk_live_…`/`efk_test_…`) — Parte 6.B.1.',
        },
        session: {
          type: 'apiKey',
          in: 'cookie',
          name: 'ef_access',
          description: 'Sessão de cookie dos painéis (login RF-07).',
        },
        learnerSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'ef_learner',
          description: 'Sessão leve do aprendiz (RF-05).',
        },
      },
      parameters: {
        IdempotencyKey: {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          schema: { type: 'string', minLength: 8 },
          description: 'Chave de idempotência (B.1) — repetir a mesma chave devolve a resposta original.',
        },
      },
      schemas: {
        ProblemDetails: {
          type: 'object',
          properties: {
            type: { type: 'string', format: 'uri' },
            title: { type: 'string' },
            status: { type: 'integer' },
            detail: { type: 'string' },
            trace_id: { type: 'string' },
          },
          required: ['type', 'title', 'status'],
        },
      },
    },
  };
}
