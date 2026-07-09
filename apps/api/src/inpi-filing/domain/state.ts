export type FilingStatus =
  | 'draft'
  | 'awaiting_poa'
  | 'awaiting_payment'
  | 'in_review'
  | 'filed'
  | 'granted'
  | 'rejected'
  | 'revoked';

const TERMINAL: readonly FilingStatus[] = ['granted', 'rejected', 'revoked'];

/** O cliente pode revogar a procuração a qualquer tempo, exceto após a concessão (§3.3). */
export function canRevoke(status: FilingStatus): boolean {
  return !TERMINAL.includes(status);
}

export function canConfirmData(status: FilingStatus): boolean {
  return status === 'draft';
}

export function canUploadPoa(status: FilingStatus): boolean {
  return status === 'awaiting_poa';
}

export function canConfirmPayment(status: FilingStatus): boolean {
  return status === 'awaiting_payment';
}

export function canRunChecklist(status: FilingStatus): boolean {
  return status === 'in_review';
}

export function canProtocol(status: FilingStatus): boolean {
  return status === 'in_review';
}

export function canRecordRpiEvent(status: FilingStatus): boolean {
  return status === 'filed';
}

export function canGrant(status: FilingStatus): boolean {
  return status === 'filed';
}

export function canReject(status: FilingStatus): boolean {
  return status === 'in_review' || status === 'filed';
}

export interface PoaValidationInput {
  holderType: 'pf' | 'pj';
  signerDocType: 'e-cpf' | 'e-cnpj';
  hasPadesMarkers: boolean;
}

export interface PoaValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Regras da procuração assinada (Gherkin §3.5): precisa ter assinatura PAdES e,
 * se o titular for PJ, o certificado do signatário precisa ser e-CNPJ — um
 * representante não pode assinar pela empresa com o e-CPF pessoal dele.
 */
export function validatePoaSignature(input: PoaValidationInput): PoaValidationResult {
  if (!input.hasPadesMarkers) {
    return { valid: false, reason: 'O PDF enviado não contém uma assinatura digital no padrão PAdES.' };
  }
  if (input.holderType === 'pj' && input.signerDocType !== 'e-cnpj') {
    return {
      valid: false,
      reason:
        'Pessoa jurídica deve assinar a procuração com certificado e-CNPJ — o representante legal não ' +
        'pode assinar com o e-CPF pessoal dele.',
    };
  }
  return { valid: true };
}
