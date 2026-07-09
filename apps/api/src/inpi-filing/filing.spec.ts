import { describe, expect, it } from 'vitest';
import { AppError } from '../common/errors';
import { AuditService } from '../admin/audit.service';
import { InMemoryAuditLogRepository } from '../admin/testing/fakes';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  InMemoryWebhookDeliveryRepository,
  InMemoryWebhookEndpointRepository,
  InMemoryWebhookEnqueuer,
  InMemoryWebhookProjectRepository,
} from '../webhooks/testing/fakes';
import { FilingService } from './filing.service';
import { OperatorService } from './operator.service';
import {
  FakeFilingStorage,
  FakeSignatureValidator,
  InMemoryFilingCertificateRepository,
  InMemoryFilingEventRepository,
  InMemoryFilingRepository,
} from './testing/fakes';

const CUSTOMER = 'customer-1';
const OPERATOR = { id: 'operator-1', role: 'admin' };

async function expectError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('esperava AppError');
}

function build() {
  const filings = new InMemoryFilingRepository();
  const events = new InMemoryFilingEventRepository();
  const certificates = new InMemoryFilingCertificateRepository();
  const storage = new FakeFilingStorage();
  const signatures = new FakeSignatureValidator();
  const audit = new AuditService(new InMemoryAuditLogRepository());
  const webhookEndpoints = new InMemoryWebhookEndpointRepository();
  const webhookDeliveries = new InMemoryWebhookDeliveryRepository();
  const webhooks = new WebhooksService(
    webhookEndpoints,
    webhookDeliveries,
    new InMemoryWebhookProjectRepository(),
    new InMemoryWebhookEnqueuer(),
    'test-encryption-key-32-chars-ok',
  );

  const filingService = new FilingService(
    filings,
    events,
    certificates,
    storage,
    signatures,
    { serviceFeeCents: 29700, gruFeeCents: 21000 },
    webhooks,
  );
  const operatorService = new OperatorService(filings, events, storage, audit, webhooks);

  return {
    filingService,
    operatorService,
    filings,
    events,
    certificates,
    storage,
    signatures,
    audit,
    webhookEndpoints,
    webhookDeliveries,
  };
}

const PADES_PDF = Buffer.from('%PDF-1.7 PADES_OK signed-bytes');
const PLAIN_PDF = Buffer.from('%PDF-1.7 sem assinatura nenhuma');

/** Simula o upload direto ao objeto pré-assinado (M2) e então confirma a procuração. */
async function uploadPoa(
  kit: ReturnType<typeof build>,
  filingId: string,
  bytes: Buffer,
  docType: 'e-cpf' | 'e-cnpj',
  docNumber: string,
) {
  const { key } = await kit.filingService.poaUploadUrl(filingId, CUSTOMER);
  kit.storage.seedUpload(key, bytes);
  return kit.filingService.confirmPoa(filingId, CUSTOMER, docType, docNumber);
}

/** Simula o upload do certificado ao objeto pré-assinado e então confirma a concessão. */
async function grant(kit: ReturnType<typeof build>, filingId: string, bytes: Buffer) {
  const { key } = await kit.operatorService.certificateUploadUrl(filingId);
  kit.storage.seedUpload(key, bytes);
  return kit.operatorService.grant(OPERATOR, filingId);
}

describe('Cenário: Contratação e coleta de dados', () => {
  it('preço decomposto em honorários e GRU 730; contrato cria o pedido em draft', async () => {
    const kit = build();
    const cert = kit.certificates.seed({ ownerUserId: CUSTOMER });

    const { filing, pricing } = await kit.filingService.contract(cert.certificateId, CUSTOMER);

    expect(pricing.gruFeeCents).toBe(21000);
    expect(pricing.serviceFeeCents).toBeGreaterThan(0);
    expect(pricing.totalCents).toBe(pricing.serviceFeeCents + pricing.gruFeeCents);
    expect(filing.status).toBe('draft');
    expect(filing.mode).toBe('assisted');
  });

  it('certificação de outro titular não pode ser contratada', async () => {
    const kit = build();
    const cert = kit.certificates.seed({ ownerUserId: 'outro-dono' });
    const err = await expectError(() => kit.filingService.contract(cert.certificateId, CUSTOMER));
    expect(err.slug).toBe('not-found');
  });

  it('não deixa abrir um segundo pedido ativo para a mesma certificação', async () => {
    const kit = build();
    const cert = kit.certificates.seed({ ownerUserId: CUSTOMER });
    await kit.filingService.contract(cert.certificateId, CUSTOMER);

    const err = await expectError(() => kit.filingService.contract(cert.certificateId, CUSTOMER));
    expect(err.slug).toBe('conflict');
  });

  it('após revogar, pode abrir um novo pedido para a mesma certificação', async () => {
    const kit = build();
    const cert = kit.certificates.seed({ ownerUserId: CUSTOMER });
    const { filing } = await kit.filingService.contract(cert.certificateId, CUSTOMER);
    await kit.filingService.revoke(filing.id, CUSTOMER);

    const second = await kit.filingService.contract(cert.certificateId, CUSTOMER);
    expect(second.filing.id).not.toBe(filing.id);
  });
});

describe('Cenário: Validação da procuração assinada', () => {
  it('PAdES presente + PF assina com e-CPF → aceita e muda para awaiting_payment', async () => {
    const kit = build();
    const cert = kit.certificates.seed({ ownerUserId: CUSTOMER });
    const { filing } = await kit.filingService.contract(cert.certificateId, CUSTOMER);
    await kit.filingService.submitData(filing.id, CUSTOMER, {
      holder: { type: 'pf', docNumber: '123.456.789-00', name: 'Marina' },
      authors: [{ name: 'Marina', cpf: '123.456.789-00' }],
    });

    const updated = await uploadPoa(kit, filing.id, PADES_PDF, 'e-cpf', '123.456.789-00');

    expect(updated.status).toBe('awaiting_payment');
    expect(updated.poaPdfS3Key).toBeTruthy();
    const events = await kit.events.listForFiling(filing.id);
    expect(events.some((e) => e.kind === 'poa_signed')).toBe(true);
  });

  it('PDF sem assinatura PAdES é recusado e o status não muda', async () => {
    const kit = build();
    const cert = kit.certificates.seed({ ownerUserId: CUSTOMER });
    const { filing } = await kit.filingService.contract(cert.certificateId, CUSTOMER);
    await kit.filingService.submitData(filing.id, CUSTOMER, {
      holder: { type: 'pf', docNumber: '123.456.789-00', name: 'Marina' },
      authors: [],
    });

    const err = await expectError(() =>
      uploadPoa(kit, filing.id, PLAIN_PDF, 'e-cpf', '123.456.789-00'),
    );
    expect(err.slug).toBe('conflict');
    expect(err.detail).toContain('PAdES');
    const after = await kit.filings.findById(filing.id);
    expect(after?.status).toBe('awaiting_poa');
  });
});

describe('Cenário: Procuração assinada por representante com e-CPF é recusada', () => {
  it('titular PJ + assinatura com e-CPF do sócio é recusada com explicação', async () => {
    const kit = build();
    const cert = kit.certificates.seed({ ownerUserId: CUSTOMER });
    const { filing } = await kit.filingService.contract(cert.certificateId, CUSTOMER);
    await kit.filingService.submitData(filing.id, CUSTOMER, {
      holder: { type: 'pj', docNumber: '12.345.678/0001-90', name: 'Biologia Viva Ltda' },
      authors: [],
    });

    const err = await expectError(() =>
      uploadPoa(kit, filing.id, PADES_PDF, 'e-cpf', '123.456.789-00'),
    );
    expect(err.slug).toBe('conflict');
    expect(err.detail).toContain('e-CNPJ');
  });
});

describe('Cenário: Execução e protocolo pela equipe', () => {
  async function bringToInReview(kit: ReturnType<typeof build>) {
    const cert = kit.certificates.seed({ ownerUserId: CUSTOMER });
    const { filing } = await kit.filingService.contract(cert.certificateId, CUSTOMER);
    await kit.filingService.submitData(filing.id, CUSTOMER, {
      holder: { type: 'pf', docNumber: '123.456.789-00', name: 'Marina' },
      authors: [],
    });
    await uploadPoa(kit, filing.id, PADES_PDF, 'e-cpf', '123.456.789-00');
    await kit.filingService.confirmPayment(filing.id, CUSTOMER);
    return filing.id;
  }

  it('protocolo exige checklist completo (DV assinada + dupla conferência)', async () => {
    const kit = build();
    const filingId = await bringToInReview(kit);

    const err = await expectError(() =>
      kit.operatorService.protocol(OPERATOR, filingId, { gruNumber: 'GRU-1', inpiProcessNumber: 'BR512026001' }),
    );
    expect(err.slug).toBe('conflict');
  });

  it('com checklist completo, protocola e grava nosso número + processo', async () => {
    const kit = build();
    const filingId = await bringToInReview(kit);
    await kit.operatorService.updateChecklist(OPERATOR, filingId, { dvSigned: true, doubleChecked: true, doubleCheckedBy: 'op-2' });
    await kit.webhookEndpoints.create({
      ownerUserId: CUSTOMER,
      projectId: null,
      url: 'https://example.com/hook',
      events: ['inpi.filing.status_changed'],
      secretSealed: { iv: 'x', tag: 'y', data: 'z' },
    });

    const updated = await kit.operatorService.protocol(OPERATOR, filingId, {
      gruNumber: 'GRU-0142',
      inpiProcessNumber: 'BR 51 2026 001234-5',
    });

    expect(updated.status).toBe('filed');
    expect(updated.gruNumber).toBe('GRU-0142');
    expect(updated.inpiProcessNumber).toBe('BR 51 2026 001234-5');
    const events = await kit.events.listForFiling(filingId);
    expect(events.some((e) => e.kind === 'filed')).toBe(true);
    const auditLogs = await kit.audit.listForTarget('inpi_filing', filingId, 10);
    expect(auditLogs.some((l) => l.action === 'inpi_filing.protocol')).toBe(true);
    expect(kit.webhookDeliveries.rows).toHaveLength(1);
    expect(kit.webhookDeliveries.rows[0]?.eventType).toBe('inpi.filing.status_changed');
  });
});

describe('Cenário: Acompanhamento da RPI e entrega do certificado', () => {
  it('evento de RPI e concessão ficam na linha do tempo; dossiê expõe procuração + certificado', async () => {
    const kit = build();
    const cert = kit.certificates.seed({ ownerUserId: CUSTOMER });
    const { filing } = await kit.filingService.contract(cert.certificateId, CUSTOMER);
    await kit.filingService.submitData(filing.id, CUSTOMER, {
      holder: { type: 'pf', docNumber: '123.456.789-00', name: 'Marina' },
      authors: [],
    });
    await uploadPoa(kit, filing.id, PADES_PDF, 'e-cpf', '123.456.789-00');
    await kit.filingService.confirmPayment(filing.id, CUSTOMER);
    await kit.operatorService.updateChecklist(OPERATOR, filing.id, { dvSigned: true, doubleChecked: true });
    await kit.operatorService.protocol(OPERATOR, filing.id, { gruNumber: 'GRU-1', inpiProcessNumber: 'BR512026001' });

    await kit.operatorService.recordRpiEvent(OPERATOR, filing.id, 'Despacho de exigência formal — nenhuma pendência.');
    const granted = await grant(kit, filing.id, Buffer.from('%PDF certificado'));

    expect(granted.status).toBe('granted');
    expect(granted.certificateS3Key).toBeTruthy();

    const timeline = await kit.filingService.getTimeline(filing.id, CUSTOMER);
    expect(timeline.events.map((e) => e.kind)).toEqual(
      expect.arrayContaining(['created', 'poa_signed', 'gru_paid', 'filed', 'rpi_dispatch', 'granted']),
    );
    expect(timeline.poaUrl).toBeTruthy();
    expect(timeline.certificateUrl).toBeTruthy();
  });
});

describe('Cenário: Revogação da procuração', () => {
  it('revoga um pedido em andamento e ele para de aceitar novas ações', async () => {
    const kit = build();
    const cert = kit.certificates.seed({ ownerUserId: CUSTOMER });
    const { filing } = await kit.filingService.contract(cert.certificateId, CUSTOMER);

    const revoked = await kit.filingService.revoke(filing.id, CUSTOMER);
    expect(revoked.status).toBe('revoked');

    const err = await expectError(() => kit.filingService.revoke(filing.id, CUSTOMER));
    expect(err.slug).toBe('conflict');
  });

  it('pedido já concedido não pode mais ser revogado', async () => {
    const kit = build();
    const cert = kit.certificates.seed({ ownerUserId: CUSTOMER });
    const { filing } = await kit.filingService.contract(cert.certificateId, CUSTOMER);
    await kit.filingService.submitData(filing.id, CUSTOMER, {
      holder: { type: 'pf', docNumber: '123.456.789-00', name: 'Marina' },
      authors: [],
    });
    await uploadPoa(kit, filing.id, PADES_PDF, 'e-cpf', '123.456.789-00');
    await kit.filingService.confirmPayment(filing.id, CUSTOMER);
    await kit.operatorService.updateChecklist(OPERATOR, filing.id, { dvSigned: true, doubleChecked: true });
    await kit.operatorService.protocol(OPERATOR, filing.id, { gruNumber: 'GRU-1', inpiProcessNumber: 'BR1' });
    await grant(kit, filing.id, Buffer.from('cert'));

    const err = await expectError(() => kit.filingService.revoke(filing.id, CUSTOMER));
    expect(err.slug).toBe('conflict');
  });
});
