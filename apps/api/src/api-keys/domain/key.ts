import { generateToken, hashToken } from '../../auth/domain/crypto';

export type ApiKeyEnvironment = 'live' | 'test';

export interface GeneratedApiKey {
  /** Valor bruto — exibido uma única vez, nunca persistido em claro (Parte 6.B.1). */
  fullKey: string;
  /** Prefixo estável para listagem/identificação (`efk_live_a1b2c3d4`). */
  keyPrefix: string;
}

const PREFIX_VISIBLE_CHARS = 8;

export function generateApiKeyValue(environment: ApiKeyEnvironment): GeneratedApiKey {
  const namespace = `efk_${environment}_`;
  const fullKey = `${namespace}${generateToken(24)}`;
  return { fullKey, keyPrefix: fullKey.slice(0, namespace.length + PREFIX_VISIBLE_CHARS) };
}

export function hashApiKeyValue(fullKey: string, pepper: string): string {
  return hashToken(fullKey, pepper);
}

export function parseApiKeyEnvironment(fullKey: string): ApiKeyEnvironment | null {
  if (fullKey.startsWith('efk_live_')) return 'live';
  if (fullKey.startsWith('efk_test_')) return 'test';
  return null;
}
