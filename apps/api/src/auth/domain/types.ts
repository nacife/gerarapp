import type { Role, UserStatus } from '@eduforge/config';
import type { SealedSecret } from './crypto';

export interface MfaConfig {
  type: 'totp';
  enabled: boolean;
  secret: SealedSecret;
  backupCodeHashes: string[];
}

export interface ConsentRecord {
  version: string;
  acceptedAt: string;
  ip?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
  passwordHash: string | null;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  mfa: MfaConfig | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  device: { ip?: string; userAgent?: string } | null;
}
