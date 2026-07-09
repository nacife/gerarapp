import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto';

describe('encryptSecret / decryptSecret', () => {
  it('decifra de volta ao texto original', () => {
    const sealed = encryptSecret('meu-segredo-secreto', 'chave-de-32-caracteres-ou-mais!!');
    expect(decryptSecret(sealed, 'chave-de-32-caracteres-ou-mais!!')).toBe('meu-segredo-secreto');
  });

  it('cada chamada usa um IV diferente (não determinístico)', () => {
    const a = encryptSecret('valor', 'chave-de-32-caracteres-ou-mais!!');
    const b = encryptSecret('valor', 'chave-de-32-caracteres-ou-mais!!');
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('decifrar com a chave errada falha', () => {
    const sealed = encryptSecret('valor', 'chave-correta-de-32-caracteres!');
    expect(() => decryptSecret(sealed, 'chave-errada-com-32-caracteres!')).toThrow();
  });

  it('dado selado adulterado falha na decifragem (autenticação do GCM)', () => {
    const sealed = encryptSecret('valor', 'chave-de-32-caracteres-ou-mais!!');
    const tampered = { ...sealed, data: Buffer.from('lixo-adulterado').toString('base64') };
    expect(() => decryptSecret(tampered, 'chave-de-32-caracteres-ou-mais!!')).toThrow();
  });
});
