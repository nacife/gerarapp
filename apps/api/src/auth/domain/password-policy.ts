import { AUTH } from '@eduforge/config';

/**
 * Checagem de senha vazada (RF-07: "verificação contra listas de senhas
 * vazadas"). A integração real (HIBP k-anonymity) fica atrás desta interface;
 * no MVP usamos uma lista local de senhas comuns.
 * TODO(prd:RF-07): implementar HibpBreachedPasswordChecker.
 */
export interface BreachedPasswordChecker {
  isBreached(password: string): Promise<boolean>;
}

const COMMON_PASSWORDS = new Set([
  '123456',
  '123456789',
  '12345678',
  'password',
  'senha123',
  'qwerty',
  'qwerty123',
  '111111',
  '123123',
  'abc123',
  'password1',
  'iloveyou',
  'admin123',
  '1q2w3e4r',
  'senhasenha',
]);

export class LocalBreachedPasswordChecker implements BreachedPasswordChecker {
  async isBreached(password: string): Promise<boolean> {
    return COMMON_PASSWORDS.has(password.toLowerCase());
  }
}

export interface PasswordPolicyResult {
  ok: boolean;
  errors: string[];
}

/**
 * Valida a política de senha (RF-07: mínimo de 10 caracteres + não vazada).
 * A checagem de vazamento é assíncrona e feita separadamente pelo caller.
 */
export function validatePasswordStrength(password: string): PasswordPolicyResult {
  const errors: string[] = [];
  if (password.length < AUTH.minPasswordLength) {
    errors.push(`A senha deve ter ao menos ${AUTH.minPasswordLength} caracteres.`);
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    errors.push('A senha deve conter letras e números.');
  }
  return { ok: errors.length === 0, errors };
}
