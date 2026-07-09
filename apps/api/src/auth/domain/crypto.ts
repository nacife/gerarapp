import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Cifra reversível (secret TOTP, secret de webhook) mora em @eduforge/schemas
// porque o worker também precisa decifrar (assinatura HMAC na entrega).
export { encryptSecret, decryptSecret, type SealedSecret } from '@eduforge/schemas/crypto';

/** Gera um token opaco (base64url) de alta entropia. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Hash determinístico de um token para armazenamento (SHA-256 + pepper). */
export function hashToken(token: string, pepper: string): string {
  return createHash('sha256')
    .update(token + pepper, 'utf8')
    .digest('hex');
}

/** Comparação em tempo constante de dois hashes hex. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Gera N códigos de backup legíveis (ex.: "a1b2-c3d4"). */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(4).toString('hex');
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
}
