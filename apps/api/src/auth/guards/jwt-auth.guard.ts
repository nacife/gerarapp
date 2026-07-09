import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY, type AuthenticatedUser } from '../../common/decorators';
import { Errors } from '../../common/errors';
import { ACCESS_COOKIE } from '../../common/cookies';
import type { AccessTokenService } from '../domain/access-token';
import { ACCESS_TOKEN_SERVICE } from '../tokens';

type RequestWithAuth = FastifyRequest & {
  cookies?: Record<string, string | undefined>;
  user?: AuthenticatedUser;
};

function extractToken(req: RequestWithAuth): string | undefined {
  const header = req.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[ACCESS_COOKIE];
}

/** Bearer de API key (`efk_live_…`/`efk_test_…`) — não é um JWT, tratado pelo ApiKeyAuthGuard. */
function isApiKeyShaped(token: string): boolean {
  return token.startsWith('efk_live_') || token.startsWith('efk_test_');
}

/** Autentica via access token (cookie httpOnly ou Bearer). Respeita @Public. Bearer de API key é repassado ao ApiKeyAuthGuard. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_SERVICE) private readonly accessTokens: AccessTokenService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<RequestWithAuth>();
    const token = extractToken(req);
    if (!token) throw Errors.unauthorized();
    if (isApiKeyShaped(token)) return true;

    const claims = this.accessTokens.verify(token);
    if (!claims) throw Errors.unauthorized();

    req.user = {
      id: claims.sub,
      role: claims.role,
      mfa: claims.mfa,
      impersonatorId: claims.impersonatorId,
    };
    return true;
  }
}
