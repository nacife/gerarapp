import jwt from 'jsonwebtoken';

/**
 * Token do aprendiz — "conta leve" (RF-04/RF-05): sem refresh rotativo nem
 * MFA, um único access token de vida mais longa. `kind` evita confusão com
 * os claims de creator/admin mesmo compartilhando o mesmo JWT_SECRET.
 */
export interface LearnerTokenService {
  sign(learnerId: string): string;
  verify(token: string): string | null;
}

export class JwtLearnerTokenService implements LearnerTokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlSec: number,
  ) {}

  sign(learnerId: string): string {
    return jwt.sign({ sub: learnerId, kind: 'learner' }, this.secret, {
      algorithm: 'HS256',
      expiresIn: this.ttlSec,
    });
  }

  verify(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.secret) as jwt.JwtPayload;
      if (decoded.kind === 'learner' && typeof decoded.sub === 'string') return decoded.sub;
      return null;
    } catch {
      return null;
    }
  }
}
