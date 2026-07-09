import { randomBytes } from 'node:crypto';

/** Código curto e legível para verificação pública do certificado (QR). */
export function generateVerifyCode(): string {
  return randomBytes(5).toString('hex').toUpperCase();
}
