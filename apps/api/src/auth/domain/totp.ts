import { authenticator } from 'otplib';

/** Contrato de TOTP (RF-07: MFA por TOTP). */
export interface TotpService {
  generateSecret(): string;
  keyUri(accountName: string, issuer: string, secret: string): string;
  verify(token: string, secret: string): boolean;
}

export class OtplibTotpService implements TotpService {
  constructor() {
    // Tolera 1 janela (±30s) de desvio de relógio.
    authenticator.options = { window: 1 };
  }

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  keyUri(accountName: string, issuer: string, secret: string): string {
    return authenticator.keyuri(accountName, issuer, secret);
  }

  verify(token: string, secret: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }
}
