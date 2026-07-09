import { Algorithm, hash, verify } from '@node-rs/argon2';

/** Contrato de hashing de senha (RF-07: Argon2id). */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hashed: string, password: string): Promise<boolean>;
}

/**
 * Argon2id via @node-rs/argon2 (binários pré-compilados, sem toolchain nativa).
 * Parâmetros ~OWASP: 19 MiB, 2 iterações, paralelismo 1.
 */
export class Argon2idHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(hashed: string, password: string): Promise<boolean> {
    try {
      return await verify(hashed, password);
    } catch {
      return false;
    }
  }
}
