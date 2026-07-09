import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { FastifyRequest } from 'fastify';
import { type Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Errors } from './errors';
import type { AuthenticatedUser } from './decorators';

const TTL_SEC = 24 * 60 * 60;
const PENDING = '__pending__';

export const IDEMPOTENCY_REDIS = Symbol('IDEMPOTENCY_REDIS');

/**
 * Idempotency-Key obrigatória em rotas POST com efeito colateral (Parte 6.B.1,
 * explicitamente exigida para `/publish` e `/inpi/*`). Repetir a mesma chave
 * dentro de 24h devolve a resposta original em vez de repetir o efeito.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(IDEMPOTENCY_REDIS) private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const key = req.headers['idempotency-key'];
    if (!key || Array.isArray(key)) throw Errors.idempotencyKeyRequired();

    const user = (req as unknown as { user?: AuthenticatedUser }).user;
    const routeKey = req.routerPath ?? req.url;
    const redisKey = `idem:${routeKey}:${user?.id ?? 'anon'}:${key}`;

    const claimed = await this.redis.set(redisKey, PENDING, 'EX', TTL_SEC, 'NX');
    if (!claimed) {
      const existing = await this.redis.get(redisKey);
      if (existing === PENDING || existing === null) {
        throw Errors.conflict('Requisição com esta Idempotency-Key ainda está em andamento.');
      }
      return of(JSON.parse(existing));
    }

    return next.handle().pipe(
      tap({
        next: async (body: unknown) => {
          await this.redis.set(redisKey, JSON.stringify(body ?? null), 'EX', TTL_SEC);
        },
        error: async () => {
          // Falhou — libera a chave para permitir nova tentativa.
          await this.redis.del(redisKey);
        },
      }),
    );
  }
}
