import { type CanActivate, type ExecutionContext, Inject, Injectable, createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Errors } from '../common/errors';
import type { LearnerTokenService } from './domain/learner-token';
import { LEARNER_ACCESS_COOKIE } from './learner-cookies';
import { LEARNER_TOKEN_SERVICE } from './tokens';

export interface AuthenticatedLearner {
  id: string;
}

type RequestWithLearner = FastifyRequest & {
  cookies?: Record<string, string | undefined>;
  learner?: AuthenticatedLearner;
};

function extractToken(req: RequestWithLearner): string | undefined {
  const header = req.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[LEARNER_ACCESS_COOKIE];
}

/** Autentica aprendizes (conta leve) — realm separado do JwtAuthGuard de creators. */
@Injectable()
export class LearnerAuthGuard implements CanActivate {
  constructor(@Inject(LEARNER_TOKEN_SERVICE) private readonly tokens: LearnerTokenService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestWithLearner>();
    const token = extractToken(req);
    if (!token) throw Errors.unauthorized();
    const learnerId = this.tokens.verify(token);
    if (!learnerId) throw Errors.unauthorized();
    req.learner = { id: learnerId };
    return true;
  }
}

export const CurrentLearner = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedLearner => {
    const req = ctx.switchToHttp().getRequest<{ learner: AuthenticatedLearner }>();
    return req.learner;
  },
);
