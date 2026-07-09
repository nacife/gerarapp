import { describe, expect, it } from 'vitest';
import {
  canConfirmData,
  canConfirmPayment,
  canGrant,
  canProtocol,
  canRecordRpiEvent,
  canReject,
  canRevoke,
  canRunChecklist,
  canUploadPoa,
  validatePoaSignature,
  type FilingStatus,
} from './state';

describe('transições de status do Registro Assistido', () => {
  it('canRevoke é verdadeiro em qualquer status não-terminal', () => {
    const nonTerminal: FilingStatus[] = ['draft', 'awaiting_poa', 'awaiting_payment', 'in_review', 'filed'];
    for (const s of nonTerminal) expect(canRevoke(s)).toBe(true);
    for (const s of ['granted', 'rejected', 'revoked'] as FilingStatus[]) expect(canRevoke(s)).toBe(false);
  });

  it('cada ação só é permitida no status esperado', () => {
    expect(canConfirmData('draft')).toBe(true);
    expect(canConfirmData('awaiting_poa')).toBe(false);

    expect(canUploadPoa('awaiting_poa')).toBe(true);
    expect(canUploadPoa('draft')).toBe(false);

    expect(canConfirmPayment('awaiting_payment')).toBe(true);
    expect(canConfirmPayment('in_review')).toBe(false);

    expect(canRunChecklist('in_review')).toBe(true);
    expect(canProtocol('in_review')).toBe(true);
    expect(canProtocol('filed')).toBe(false);

    expect(canRecordRpiEvent('filed')).toBe(true);
    expect(canGrant('filed')).toBe(true);
    expect(canGrant('in_review')).toBe(false);

    expect(canReject('in_review')).toBe(true);
    expect(canReject('filed')).toBe(true);
    expect(canReject('granted')).toBe(false);
  });
});

describe('validatePoaSignature (Gherkin §3.5)', () => {
  it('procuração válida: PAdES presente + PF assina com e-CPF', () => {
    const r = validatePoaSignature({ holderType: 'pf', signerDocType: 'e-cpf', hasPadesMarkers: true });
    expect(r.valid).toBe(true);
  });

  it('procuração válida: PAdES presente + PJ assina com e-CNPJ', () => {
    const r = validatePoaSignature({ holderType: 'pj', signerDocType: 'e-cnpj', hasPadesMarkers: true });
    expect(r.valid).toBe(true);
  });

  it('sem assinatura PAdES é sempre recusado', () => {
    const r = validatePoaSignature({ holderType: 'pf', signerDocType: 'e-cpf', hasPadesMarkers: false });
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('PAdES');
  });

  it('PJ assinado com e-CPF do representante é recusado com explicação', () => {
    const r = validatePoaSignature({ holderType: 'pj', signerDocType: 'e-cpf', hasPadesMarkers: true });
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('e-CNPJ');
  });
});
