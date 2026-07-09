import { Errors } from '../common/errors';
import { encryptSecret, generateBackupCodes } from './domain/crypto';
import type { TotpService } from './domain/totp';
import type { MfaConfig } from './domain/types';
import { hashBackupCode, verifyMfaCode } from './mfa.util';
import type { UserRepository } from './ports';

export interface MfaSetupResult {
  secret: string;
  otpauthUrl: string;
}

export interface MfaEnableResult {
  backupCodes: string[];
}

/** Configuração de MFA/TOTP do usuário (RF-07). */
export class MfaService {
  constructor(
    private readonly users: UserRepository,
    private readonly totp: TotpService,
    private readonly encryptionKey: string,
    private readonly issuer = 'EduForge',
  ) {}

  /** Passo 1: gera segredo pendente e devolve o otpauth:// para o QR code. */
  async setup(userId: string): Promise<MfaSetupResult> {
    const user = await this.users.findById(userId);
    if (!user) throw Errors.unauthorized();

    const secret = this.totp.generateSecret();
    const pending: MfaConfig = {
      type: 'totp',
      enabled: false,
      secret: encryptSecret(secret, this.encryptionKey),
      backupCodeHashes: [],
    };
    await this.users.setMfa(userId, pending);

    return { secret, otpauthUrl: this.totp.keyUri(user.email, this.issuer, secret) };
  }

  /** Passo 2: confirma um código, ativa o MFA e retorna os códigos de backup. */
  async enable(userId: string, code: string): Promise<MfaEnableResult> {
    const user = await this.users.findById(userId);
    if (!user?.mfa) throw Errors.invalidMfaCode();
    if (user.mfa.enabled) throw Errors.invalidMfaCode();

    const result = verifyMfaCode(user.mfa, code, this.totp, this.encryptionKey);
    if (!result.ok) throw Errors.invalidMfaCode();

    const backupCodes = generateBackupCodes();
    await this.users.setMfa(userId, {
      ...user.mfa,
      enabled: true,
      backupCodeHashes: backupCodes.map((c) => hashBackupCode(c, this.encryptionKey)),
    });
    return { backupCodes };
  }

  /** Desativa o MFA (exige código válido). */
  async disable(userId: string, code: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user?.mfa?.enabled) return;
    const result = verifyMfaCode(user.mfa, code, this.totp, this.encryptionKey);
    if (!result.ok) throw Errors.invalidMfaCode();
    await this.users.setMfa(userId, null);
  }
}
