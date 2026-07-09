import { decryptSecret, hashToken, safeEqualHex } from './domain/crypto';
import type { MfaConfig } from './domain/types';
import type { TotpService } from './domain/totp';

export interface MfaVerifyResult {
  ok: boolean;
  usedBackup: boolean;
  remainingBackupHashes: string[];
}

/** Hash de um código de backup para armazenamento (não guardamos o valor bruto). */
export function hashBackupCode(code: string, encryptionKey: string): string {
  return hashToken(code.trim().toLowerCase(), encryptionKey);
}

/**
 * Verifica um código MFA: primeiro TOTP, depois códigos de backup (uso único).
 * Retorna os hashes de backup restantes quando um backup é consumido.
 */
export function verifyMfaCode(
  mfa: MfaConfig,
  code: string,
  totp: TotpService,
  encryptionKey: string,
): MfaVerifyResult {
  const normalized = code.trim();

  const secret = decryptSecret(mfa.secret, encryptionKey);
  if (/^\d{6}$/.test(normalized) && totp.verify(normalized, secret)) {
    return { ok: true, usedBackup: false, remainingBackupHashes: mfa.backupCodeHashes };
  }

  const codeHash = hashBackupCode(normalized, encryptionKey);
  const idx = mfa.backupCodeHashes.findIndex((h) => safeEqualHex(h, codeHash));
  if (idx >= 0) {
    const remaining = mfa.backupCodeHashes.filter((_, i) => i !== idx);
    return { ok: true, usedBackup: true, remainingBackupHashes: remaining };
  }

  return { ok: false, usedBackup: false, remainingBackupHashes: mfa.backupCodeHashes };
}
