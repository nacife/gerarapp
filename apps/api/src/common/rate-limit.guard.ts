import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import { SHARED_REDIS } from './redis.module';

export const RATE_LIMIT_KEY = 'rateLimit';
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

export interface RateLimitOptions {
  /** Requisições por janela. Default: 60. */
  max?: number;
  /** Janela em segundos. Default: 60. */
  windowSec?: number;
}

export const RateLimit = (opts?: RateLimitOptions) =>
  Reflect.defineMetadata(RATE_LIMIT_KEY, opts ?? {}, Reflect);

/**
 * Decorator para pular rate limiting (ex.: webhooks entrantes).
 */
export const SkipRateLimit = () => Reflect.defineMetadata(SKIP_RATE_LIMIT_KEY, true, Reflect);

/**
 * Guard global de rate limiting (ADR-0071).
 * Aplica-se a TODAS as requisições autenticadas por sessão E API key,
 * usando como chave o userId (sessão) ou apiKeyId (API key).
 * Endpoints @Public() são rate-limited por IP.
 */
@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  constructor(
    @Inject(SHARED_REDIS) private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: { id: string }; apiKeyId?: string }>();
    const override = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const max = override?.max ?? 60;
    const windowSec = override?.windowSec ?? 60;

    // Chave: userId (sessão), apiKeyId (API key), ou IP (público).
    const key = req.user?.id ?? req.apiKeyId ?? `ip:${req.ip ?? 'unknown'}`;
    const bucketKey = `rate:${key}`;

    const current = await this.redis.incr(bucketKey);
    if (current === 1) {
      await this.redis.expire(bucketKey, windowSec);
    }

    const res = ctx.switchToHttp().getResponse<FastifyReply>();
    res.header('X-RateLimit-Limit', String(max));
    res.header('X-RateLimit-Remaining', String(Math.max(0, max - current)));
    res.header('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + windowSec));

    if (current > max) {
      res.status(429).send({
        type: 'https://docs.eduforge.app/errors/rate-limit-exceeded',
        title: 'Limite de requisições excedido',
        status: 429,
        detail: `Limite de ${max} req/${windowSec}s. Tente novamente em breve.`,
        retryAfterSec: windowSec,
      });
      return false;
    }

    return true;
  }
}
