import jwt from 'jsonwebtoken';
import type { Role } from '@eduforge/config';

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  /** MFA satisfeito nesta sessão. */
  mfa: boolean;
  /** Presente durante impersonação: id do admin que iniciou a sessão (RF-12). */
  impersonatorId?: string;
}

/** Emite e valida access tokens JWT de curta duração (RF-07). */
export interface AccessTokenService {
  sign(claims: AccessTokenClaims): string;
  verify(token: string): AccessTokenClaims | null;
}

export class JwtAccessTokenService implements AccessTokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlSec: number,
  ) {}

  sign(claims: AccessTokenClaims): string {
    return jwt.sign(claims, this.secret, {
      algorithm: 'HS256',
      expiresIn: this.ttlSec,
    });
  }

  verify(token: string): AccessTokenClaims | null {
    try {
      const decoded = jwt.verify(token, this.secret) as jwt.JwtPayload;
      if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') return null;
      return {
        sub: decoded.sub,
        role: decoded.role as Role,
        mfa: decoded.mfa === true,
        impersonatorId: typeof decoded.impersonatorId === 'string' ? decoded.impersonatorId : undefined,
      };
    } catch {
      return null;
    }
  }
}
