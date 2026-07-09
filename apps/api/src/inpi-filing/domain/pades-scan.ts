export interface PadesScanResult {
  hasPadesMarkers: boolean;
  subFilter: string | null;
}

const PADES_SUBFILTERS = new Set(['ETSI.CAdES.detached', 'adbe.pkcs7.detached']);

/**
 * Detecção estrutural de assinatura PAdES nos bytes do PDF (RF-17/M8 DoD):
 * verifica a PRESENÇA do dicionário de assinatura (`/ByteRange` + `/SubFilter`
 * reconhecido) — não decodifica nem valida a cadeia criptográfica (isso fica
 * atrás de `SignatureValidator`, mockado em dev). Suficiente para rejeitar de
 * cara um PDF sem assinatura alguma; a legitimidade do certificado é outra camada.
 */
export function scanForPadesMarkers(pdfBytes: Buffer): PadesScanResult {
  // PDFs são texto+binário misto, mas os dicionários de assinatura em si são
  // ASCII — latin1 preserva 1 byte por char sem lançar em bytes não-UTF8.
  const text = pdfBytes.toString('latin1');
  const hasByteRange = /\/ByteRange\s*\[/.test(text);
  const subFilterMatch = text.match(/\/SubFilter\s*\/([A-Za-z0-9.]+)/);
  const subFilter = subFilterMatch ? subFilterMatch[1]! : null;
  const hasPadesMarkers = hasByteRange && subFilter !== null && PADES_SUBFILTERS.has(subFilter);
  return { hasPadesMarkers, subFilter };
}
