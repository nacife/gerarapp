import { describe, expect, it } from 'vitest';
import { generateApiKeyValue, hashApiKeyValue, parseApiKeyEnvironment } from './key';

describe('generateApiKeyValue', () => {
  it('gera chaves live com o prefixo efk_live_', () => {
    const { fullKey, keyPrefix } = generateApiKeyValue('live');
    expect(fullKey.startsWith('efk_live_')).toBe(true);
    expect(fullKey.startsWith(keyPrefix)).toBe(true);
  });

  it('gera chaves test com o prefixo efk_test_', () => {
    const { fullKey } = generateApiKeyValue('test');
    expect(fullKey.startsWith('efk_test_')).toBe(true);
  });

  it('cada chamada gera um valor único de alta entropia', () => {
    const a = generateApiKeyValue('live');
    const b = generateApiKeyValue('live');
    expect(a.fullKey).not.toBe(b.fullKey);
  });
});

describe('hashApiKeyValue', () => {
  it('é determinístico para o mesmo par (chave, pepper)', () => {
    const { fullKey } = generateApiKeyValue('live');
    expect(hashApiKeyValue(fullKey, 'pepper-1')).toBe(hashApiKeyValue(fullKey, 'pepper-1'));
  });

  it('peppers diferentes produzem hashes diferentes', () => {
    const { fullKey } = generateApiKeyValue('live');
    expect(hashApiKeyValue(fullKey, 'pepper-1')).not.toBe(hashApiKeyValue(fullKey, 'pepper-2'));
  });
});

describe('parseApiKeyEnvironment', () => {
  it('reconhece efk_live_ e efk_test_', () => {
    expect(parseApiKeyEnvironment('efk_live_abc')).toBe('live');
    expect(parseApiKeyEnvironment('efk_test_abc')).toBe('test');
  });

  it('retorna null para valores fora do formato', () => {
    expect(parseApiKeyEnvironment('sk_live_abc')).toBeNull();
    expect(parseApiKeyEnvironment('')).toBeNull();
  });
});
