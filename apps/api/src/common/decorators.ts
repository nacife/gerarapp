import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@eduforge/config';
import type { ApiKeyScope } from '../api-keys/domain/scopes';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const ALLOW_WITHOUT_MFA_KEY = 'allowWithoutMfa';
export const REQUIRE_SCOPE_KEY = 'requireScope';

/** Rota acessível sem autenticação. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe a rota aos papéis informados (RBAC). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Escopo exigido quando o chamador autentica via API key (Parte 6.B.2).
 * Ignorado para chamadas autenticadas por sessão (cookie/JWT do painel).
 */
export const RequireScope = (...scopes: ApiKeyScope[]) => SetMetadata(REQUIRE_SCOPE_KEY, scopes);

/** Permite acesso de admin ainda sem MFA (ex.: configurar o próprio MFA). */
export const AllowWithoutMfa = () => SetMetadata(ALLOW_WITHOUT_MFA_KEY, true);

export interface AuthenticatedUser {
  id: string;
  role: Role;
  mfa: boolean;
  /** Presente durante impersonação: id do admin que iniciou a sessão (RF-12). */
  impersonatorId?: string;
}

/** Injeta o usuário autenticado a partir da request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
