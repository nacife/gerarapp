import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import { Observable, of } from 'rxjs';
import { SHARED_REDIS } from '../common/redis.module';

const MAINTENANCE_KEY = 'maintenance:mode';

/**
 * Interceptor global que retorna 503 se o modo manutenção estiver ativo.
 * Rotas de admin SEMPRE passam (para permitir desligar o modo).
 */
@Injectable()
export class MaintenanceInterceptor implements NestInterceptor {
  constructor(@Inject(SHARED_REDIS) private readonly redis: Redis) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const path = req.url ?? '';

    // Admin sempre passa
    if (path.startsWith('/v1/admin') || path === '/health') {
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.redis.get(MAINTENANCE_KEY).then((mode) => {
        if (mode !== 'on') {
          next.handle().subscribe({
            next: (v) => subscriber.next(v),
            error: (e) => subscriber.error(e),
            complete: () => subscriber.complete(),
          });
        } else {
          const res = ctx.switchToHttp().getResponse<FastifyReply>();
          res.status(503).send({
            type: 'https://docs.eduforge.app/errors/maintenance',
            title: 'Em manutenção',
            status: 503,
            detail: 'A plataforma está em manutenção. Tente novamente em alguns minutos.',
          });
          subscriber.complete();
        }
      });
    });
  }
}
