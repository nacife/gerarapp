import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../common/errors';
import { buildAuthService } from './testing/fakes';

const PASSWORD = 'Biologia2026';
const device = { ip: '127.0.0.1', userAgent: 'vitest' };

async function captureError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('esperava um AppError');
}

type Kit = ReturnType<typeof buildAuthService>;

/** Cria uma conta já verificada e devolve o userId. */
async function signupVerified(kit: Kit, email = 'marina@exemplo.com'): Promise<string> {
  const { userId } = await kit.service.signup({
    email,
    password: PASSWORD,
    name: 'Marina',
    consentVersion: '2026-07',
  });
  const token = kit.mailer.lastLink()!.split('token=')[1];
  await kit.service.verifyEmail(token);
  return userId;
}

describe('AuthService — cadastro e verificação', () => {
  let kit: Kit;
  beforeEach(() => {
    kit = buildAuthService();
  });

  it('cadastra, envia verificação e bloqueia login antes de verificar', async () => {
    await kit.service.signup({
      email: 'marina@exemplo.com',
      password: PASSWORD,
      name: 'Marina',
      consentVersion: '2026-07',
    });
    expect(kit.mailer.sent).toHaveLength(1);
    const err = await captureError(() =>
      kit.service.login({ email: 'marina@exemplo.com', password: PASSWORD, device }),
    );
    expect(err.slug).toBe('email-not-verified');
  });

  it('rejeita senha fraca e senha vazada', async () => {
    const weak = await captureError(() =>
      kit.service.signup({ email: 'a@b.com', password: 'curta', name: 'X', consentVersion: 'v' }),
    );
    expect(weak.slug).toBe('weak-password');

    const breached = await captureError(() =>
      kit.service.signup({ email: 'a@b.com', password: 'password1', name: 'X', consentVersion: 'v' }),
    );
    expect(breached.slug).toBe('weak-password');
  });

  it('impede e-mail duplicado', async () => {
    await signupVerified(kit);
    const err = await captureError(() =>
      kit.service.signup({
        email: 'marina@exemplo.com',
        password: PASSWORD,
        name: 'Marina',
        consentVersion: 'v',
      }),
    );
    expect(err.slug).toBe('email-in-use');
  });
});

describe('AuthService — login e MFA (US-AUTH-01)', () => {
  let kit: Kit;
  beforeEach(() => {
    kit = buildAuthService();
  });

  it('login sem MFA emite sessão com refresh token', async () => {
    await signupVerified(kit);
    const result = await kit.service.login({ email: 'marina@exemplo.com', password: PASSWORD, device });
    expect(result.status).toBe('authenticated');
    if (result.status !== 'authenticated') return;
    expect(result.session.accessToken).toBeTruthy();
    expect(result.session.refreshToken).toBeTruthy();
  });

  it('com MFA ativo, login pede TOTP e o código válido gera sessão', async () => {
    const userId = await signupVerified(kit);
    await kit.mfaService.setup(userId);
    const { backupCodes } = await kit.mfaService.enable(userId, '123456');

    const first = await kit.service.login({ email: 'marina@exemplo.com', password: PASSWORD, device });
    expect(first.status).toBe('mfa_required');
    if (first.status !== 'mfa_required') return;

    const session = await kit.service.loginMfa({
      challengeToken: first.challengeToken,
      code: '123456',
      device,
    });
    expect(session.accessToken).toBeTruthy();

    // Código de backup também autentica e é de uso único.
    const second = await kit.service.login({ email: 'marina@exemplo.com', password: PASSWORD, device });
    if (second.status !== 'mfa_required') throw new Error('esperava mfa_required');
    await kit.service.loginMfa({
      challengeToken: second.challengeToken,
      code: backupCodes[0]!,
      device,
    });
    const third = await kit.service.login({ email: 'marina@exemplo.com', password: PASSWORD, device });
    if (third.status !== 'mfa_required') throw new Error('esperava mfa_required');
    const reuse = await captureError(() =>
      kit.service.loginMfa({ challengeToken: third.challengeToken, code: backupCodes[0]!, device }),
    );
    expect(reuse.slug).toBe('invalid-mfa-code');
  });

  it('bloqueio progressivo: CAPTCHA na 5ª falha, bloqueio na 10ª', async () => {
    await signupVerified(kit);
    for (let i = 1; i <= 9; i++) {
      const err = await captureError(() =>
        kit.service.login({ email: 'marina@exemplo.com', password: 'errada123', device }),
      );
      expect(err.slug).toBe('invalid-credentials');
      expect(err.extra?.captchaRequired).toBe(i >= 5);
    }
    const locked = await captureError(() =>
      kit.service.login({ email: 'marina@exemplo.com', password: 'errada123', device }),
    );
    expect(locked.slug).toBe('account-locked');

    // Mesmo com a senha correta, segue bloqueada.
    const stillLocked = await captureError(() =>
      kit.service.login({ email: 'marina@exemplo.com', password: PASSWORD, device }),
    );
    expect(stillLocked.slug).toBe('account-locked');
  });
});

describe('AuthService — sessões e refresh', () => {
  let kit: Kit;
  beforeEach(() => {
    kit = buildAuthService();
  });

  it('encerrar sessões remotas revoga todos os refresh tokens', async () => {
    const userId = await signupVerified(kit);
    const tokens: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await kit.service.login({ email: 'marina@exemplo.com', password: PASSWORD, device });
      if (r.status === 'authenticated') tokens.push(r.session.refreshToken);
    }
    expect(kit.sessions.countActive(userId)).toBe(3);

    const revoked = await kit.service.logoutAll(userId);
    expect(revoked).toBe(3);
    const err = await captureError(() => kit.service.refresh(tokens[0]!, device));
    expect(err.slug).toBe('unauthorized');
  });

  it('refresh rotaciona o token e invalida o antigo', async () => {
    await signupVerified(kit);
    const login = await kit.service.login({ email: 'marina@exemplo.com', password: PASSWORD, device });
    if (login.status !== 'authenticated') throw new Error('esperava sessão');
    const old = login.session.refreshToken;

    const rotated = await kit.service.refresh(old, device);
    expect(rotated.refreshToken).not.toBe(old);

    const err = await captureError(() => kit.service.refresh(old, device));
    expect(err.slug).toBe('unauthorized');
  });
});

describe('AuthService — recuperação de senha', () => {
  let kit: Kit;
  beforeEach(() => {
    kit = buildAuthService();
  });

  it('reseta a senha, revoga sessões e valida a nova credencial', async () => {
    const userId = await signupVerified(kit);
    await kit.service.login({ email: 'marina@exemplo.com', password: PASSWORD, device });
    expect(kit.sessions.countActive(userId)).toBe(1);

    await kit.service.requestPasswordReset('marina@exemplo.com');
    const token = kit.mailer.lastLink()!.split('token=')[1]!;
    const NEW = 'NovaSenha2026';
    await kit.service.resetPassword(token, NEW);

    expect(kit.sessions.countActive(userId)).toBe(0);
    const oldFails = await captureError(() =>
      kit.service.login({ email: 'marina@exemplo.com', password: PASSWORD, device }),
    );
    expect(oldFails.slug).toBe('invalid-credentials');
    const ok = await kit.service.login({ email: 'marina@exemplo.com', password: NEW, device });
    expect(ok.status).toBe('authenticated');
  });
});

describe('AccountService — LGPD', () => {
  it('exporta dados e enfileira anonimização na exclusão', async () => {
    const kit = buildAuthService();
    const userId = await signupVerified(kit);

    const dump = await kit.accountService.exportData(userId);
    expect(dump.user.email).toBe('marina@exemplo.com');

    await kit.accountService.requestDeletion(userId);
    expect(kit.deletion.enqueued).toContain(userId);
    const user = await kit.users.findById(userId);
    expect(user?.status).toBe('pending_deletion');
  });
});
