import jwt from 'jsonwebtoken';

/** Token curto emitido entre "senha correta" e "código TOTP" (RF-07). */
export interface MfaChallengeService {
  sign(userId: string): string;
  verify(token: string): string | null;
}

export class JwtMfaChallengeService implements MfaChallengeService {
  constructor(
    private readonly secret: string,
    private readonly ttlSec = 300,
  ) {}

  sign(userId: string): string {
    return jwt.sign({ sub: userId, purpose: 'mfa' }, this.secret, {
      algorithm: 'HS256',
      expiresIn: this.ttlSec,
    });
  }

  verify(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.secret) as jwt.JwtPayload;
      if (decoded.purpose === 'mfa' && typeof decoded.sub === 'string') return decoded.sub;
      return null;
    } catch {
      return null;
    }
  }
}
