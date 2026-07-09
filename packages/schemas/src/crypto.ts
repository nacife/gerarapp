/**
 * Segredo cifrado reversível (AES-256-GCM) — usado para o secret TOTP (apps/api)
 * e para o secret de assinatura de webhooks (apps/api cifra, apps/worker decifra
 * para assinar a entrega). Compartilhado pela mesma razão de `webhooks.ts`:
 * pacotes não podem depender de apps.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export interface SealedSecret {
  iv: string;
  tag: string;
  data: string;
}

export function encryptSecret(plaintext: string, keySecret: string): SealedSecret {
  const key = deriveKey(keySecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: enc.toString('base64'),
  };
}

export function decryptSecret(sealed: SealedSecret, keySecret: string): string {
  const key = deriveKey(keySecret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}
