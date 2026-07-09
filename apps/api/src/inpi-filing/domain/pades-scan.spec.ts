import { describe, expect, it } from 'vitest';
import { scanForPadesMarkers } from './pades-scan';

function fakePdf(extra: string): Buffer {
  return Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${extra}\n%%EOF`, 'latin1');
}

describe('scanForPadesMarkers', () => {
  it('detecta assinatura PAdES (ETSI.CAdES.detached) quando presente', () => {
    const pdf = fakePdf('<< /ByteRange [0 100 200 300] /SubFilter /ETSI.CAdES.detached /Contents <deadbeef> >>');
    const res = scanForPadesMarkers(pdf);
    expect(res.hasPadesMarkers).toBe(true);
    expect(res.subFilter).toBe('ETSI.CAdES.detached');
  });

  it('detecta a variante legada adbe.pkcs7.detached', () => {
    const pdf = fakePdf('<< /ByteRange [0 1 2 3] /SubFilter /adbe.pkcs7.detached >>');
    expect(scanForPadesMarkers(pdf).hasPadesMarkers).toBe(true);
  });

  it('PDF sem nenhuma assinatura não é detectado', () => {
    const pdf = fakePdf('sem nada de assinatura aqui');
    const res = scanForPadesMarkers(pdf);
    expect(res.hasPadesMarkers).toBe(false);
    expect(res.subFilter).toBeNull();
  });

  it('SubFilter presente mas sem ByteRange não conta como assinado', () => {
    const pdf = fakePdf('<< /SubFilter /ETSI.CAdES.detached >>');
    expect(scanForPadesMarkers(pdf).hasPadesMarkers).toBe(false);
  });

  it('SubFilter de tipo não reconhecido não conta como PAdES', () => {
    const pdf = fakePdf('<< /ByteRange [0 1 2 3] /SubFilter /algo.desconhecido >>');
    expect(scanForPadesMarkers(pdf).hasPadesMarkers).toBe(false);
  });
});
