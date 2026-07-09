import { scanForPadesMarkers } from './domain/pades-scan';

export interface SignatureCheckInput {
  pdfBytes: Buffer;
  declaredSignerDocType: 'e-cpf' | 'e-cnpj';
  declaredSignerDocNumber: string;
}

export interface SignatureCheckResult {
  hasPadesMarkers: boolean;
  /** Confiança na cadeia de certificação (ICP-Brasil, não revogado). Mockado em dev. */
  trusted: boolean;
  signerDocType: 'e-cpf' | 'e-cnpj';
  signerDocNumber: string;
}

/**
 * Validação de assinatura digital da procuração/DV (RF-17). A presença de
 * assinatura PAdES é verificada de verdade (`scanForPadesMarkers`); a
 * legitimidade da cadeia de certificação (ICP-Brasil, OCSP/CRL, correspondência
 * real entre o certificado e o CPF/CNPJ) exige infraestrutura de PKI que não
 * existe neste ambiente — fica atrás desta interface, mockada em dev
 * (M8 DoD: "validação criptográfica completa fica atrás de interface
 * SignatureValidator, mock em dev").
 */
export interface SignatureValidator {
  check(input: SignatureCheckInput): Promise<SignatureCheckResult>;
}

/** Confia nos dados declarados desde que a estrutura PAdES esteja presente. */
export class MockSignatureValidator implements SignatureValidator {
  async check(input: SignatureCheckInput): Promise<SignatureCheckResult> {
    const scan = scanForPadesMarkers(input.pdfBytes);
    return {
      hasPadesMarkers: scan.hasPadesMarkers,
      trusted: scan.hasPadesMarkers,
      signerDocType: input.declaredSignerDocType,
      signerDocNumber: input.declaredSignerDocNumber,
    };
  }
}
