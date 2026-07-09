import { describe, expect, it } from 'vitest';
import { detectMime, MAX_UPLOAD_BYTES, validateUpload } from './source-file';

describe('validateUpload (US-ING-01)', () => {
  it('rejeita arquivo acima de 200 MB', () => {
    expect(validateUpload({ filename: 'grande.pdf', sizeBytes: MAX_UPLOAD_BYTES + 1 })).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('rejeita formato não suportado (.pages)', () => {
    expect(validateUpload({ filename: 'apresentacao.pages', sizeBytes: 1000 })).toEqual({
      ok: false,
      reason: 'unsupported',
    });
  });

  it('aceita PDF, EPUB, DOCX e Markdown', () => {
    const cases: [string, string][] = [
      ['a.pdf', 'pdf'],
      ['a.epub', 'epub'],
      ['a.docx', 'docx'],
      ['a.md', 'md'],
    ];
    for (const [filename, mime] of cases) {
      expect(validateUpload({ filename, sizeBytes: 100 })).toEqual({ ok: true, mime });
    }
  });

  it('deduz o formato pelo content-type quando a extensão falta', () => {
    expect(detectMime('arquivo-sem-extensao', 'application/pdf')).toBe('pdf');
    expect(detectMime('doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx');
  });
});
