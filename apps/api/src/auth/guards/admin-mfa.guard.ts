import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ROLES } from '@eduforge/config';
import {
  ALLOW_WITHOUT_MFA_KEY,
  IS_PUBLIC_KEY,
  type AuthenticatedUser,
} from '../../common/decorators';
import { Errors } from '../../common/errors';

/**
 * MFA obrigatório para papéis administrativos (RF-07): um admin sem MFA
 * satisfeito é barrado — exceto nas rotas que configuram o próprio MFA.
 */
@Injectable()
export class AdminMfaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const meta = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, meta)) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_MFA_KEY, meta)) return true;

    const user = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) return true;
    if (ADMIN_ROLES.includes(user.role) && !user.mfa) throw Errors.mfaSetupRequired();
    return true;
  }
}
