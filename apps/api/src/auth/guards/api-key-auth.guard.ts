import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import { hasScope, type ApiKeyScope } from '../../api-keys/domain/scopes';
import { computeRateLimitWindow, evaluateRateLimit } from '../../api-keys/domain/rate-limit';
import { IS_PUBLIC_KEY, REQUIRE_SCOPE_KEY, type AuthenticatedUser } from '../../common/decorators';
import { Errors } from '../../common/errors';
import { AUTH_REDIS } from '../tokens';

type RequestWithAuth = FastifyRequest & {
  user?: AuthenticatedUser;
  apiKey?: { id: string; scopes: string[]; environment: string; projectId: string | null };
};

const RATE_LIMIT_PER_MINUTE = 120;

function extractBearer(req: FastifyRequest): string | undefined {
  const header = req.headers?.authorization;
  return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined;
}

function isApiKeyShaped(token: string): boolean {
  return token.startsWith('efk_live_') || token.startsWith('efk_test_');
}

/**
 * Segunda etapa da cadeia de autenticação global: só age quando o JwtAuthGuard
 * não já populou `req.user` (ou seja, quando o Bearer é uma API key, não um
 * access token de sessão). Aplica rate limit (120 req/min/chave) e escopos
 * (`@RequireScope`) — ambos exclusivos do fluxo de API key (Parte 6.B.1/B.2).
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeysService,
    @Inject(AUTH_REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<RequestWithAuth>();

    if (!req.user) {
      const token = extractBearer(req);
      if (!token || !isApiKeyShaped(token)) throw Errors.unauthorized();

      const auth = await this.apiKeys.authenticate(token);
      if (!auth) throw Errors.unauthorized();

      req.user = { id: auth.ownerUserId, role: auth.ownerRole as AuthenticatedUser['role'], mfa: true };
      req.apiKey = {
        id: auth.id,
        scopes: auth.scopes,
        environment: auth.environment,
        projectId: auth.projectId,
      };

      await this.applyRateLimit(ctx, auth.id);
    }

    this.assertScope(ctx, req.apiKey);
    return true;
  }

  private async applyRateLimit(ctx: ExecutionContext, apiKeyId: string): Promise<void> {
    const reply = ctx.switchToHttp().getResponse<FastifyReply>();
    const window = computeRateLimitWindow(apiKeyId, RATE_LIMIT_PER_MINUTE, new Date());

    const count = await this.redis.incr(window.windowKey);
    if (count === 1) await this.redis.pexpire(window.windowKey, 60_000);
    const decision = evaluateRateLimit(window, count);

    reply.header('X-RateLimit-Limit', String(RATE_LIMIT_PER_MINUTE));
    reply.header('X-RateLimit-Remaining', String(decision.remaining));
    reply.header('X-RateLimit-Reset', String(Math.floor(decision.resetAt.getTime() / 1000)));

    if (!decision.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((decision.resetAt.getTime() - Date.now()) / 1000));
      reply.header('Retry-After', String(retryAfterSec));
      throw Errors.rateLimitExceeded(retryAfterSec);
    }
  }

  private assertScope(ctx: ExecutionContext, apiKey: RequestWithAuth['apiKey']): void {
    const required = this.reflector.getAllAndOverride<ApiKeyScope[]>(REQUIRE_SCOPE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0 || !apiKey) return;
    const ok = required.every((scope) => hasScope(apiKey.scopes, scope));
    if (!ok) throw Errors.forbidden();
  }
}
