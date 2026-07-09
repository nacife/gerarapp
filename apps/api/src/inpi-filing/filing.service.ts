import { Errors } from '../common/errors';
import type { WebhooksService } from '../webhooks/webhooks.service';
import { computePricing, type PricingBreakdown } from './domain/pricing';
import { canConfirmPayment, canRevoke, canUploadPoa, validatePoaSignature } from './domain/state';
import type {
  AuthorInfo,
  FilingCertificateRepository,
  FilingEventRepository,
  FilingRepository,
  FilingRow,
  FilingStorage,
  HolderInfo,
} from './ports';
import type { SignatureValidator } from './signature-validator';

export interface FilingFeesConfig {
  serviceFeeCents: number;
  gruFeeCents: number;
}

export class FilingService {
  constructor(
    private readonly filings: FilingRepository,
    private readonly events: FilingEventRepository,
    private readonly certificates: FilingCertificateRepository,
    private readonly storage: FilingStorage,
    private readonly signatures: SignatureValidator,
    private readonly fees: FilingFeesConfig,
    private readonly webhooks: WebhooksService,
  ) {}

  pricing(): PricingBreakdown {
    return computePricing(this.fees.serviceFeeCents, this.fees.gruFeeCents);
  }

  /** Contratação (§3.2 passo 1): abre o pedido a partir de uma certificação RF-16 existente. */
  async contract(certificateId: string, customerUserId: string): Promise<{ filing: FilingRow; pricing: PricingBreakdown }> {
    const cert = await this.certificates.getForOwner(certificateId, customerUserId);
    if (!cert) throw Errors.notFound('Certificação INPI');

    const mine = await this.filings.listForCustomer(customerUserId);
    const activeDuplicate = mine.find(
      (f) => f.inpiCertificateId === certificateId && !['revoked', 'rejected'].includes(f.status),
    );
    if (activeDuplicate) {
      throw Errors.conflict(
        `Já existe um pedido de Registro Assistido em andamento para esta versão (${activeDuplicate.id}).`,
      );
    }

    const filing = await this.filings.create({ inpiCertificateId: certificateId, customerUserId });
    await this.events.record(filing.id, 'created', { certificateId, versionNumber: cert.versionNumber });

    return { filing, pricing: this.pricing() };
  }

  /** Coleta guiada (§3.2 passo 2): titularidade + autores. Só em `draft`. */
  async submitData(
    filingId: string,
    customerUserId: string,
    input: { holder: HolderInfo; authors: AuthorInfo[] },
  ): Promise<FilingRow> {
    const filing = await this.requireOwned(filingId, customerUserId);
    if (filing.status !== 'draft') {
      throw Errors.conflict('Os dados de titularidade só podem ser editados enquanto o pedido está em rascunho.');
    }
    return this.filings.update(filingId, { holder: input.holder, authors: input.authors, status: 'awaiting_poa' });
  }

  /** URL pré-assinada para o cliente enviar a procuração direto ao objeto (mesmo padrão do M2). */
  async poaUploadUrl(filingId: string, customerUserId: string): Promise<{ uploadUrl: string; key: string }> {
    const filing = await this.requireOwned(filingId, customerUserId);
    if (!canUploadPoa(filing.status)) {
      throw Errors.conflict('Este pedido não está aguardando o envio da procuração.');
    }
    const key = `inpi-filings/${filingId}/procuracao.pdf`;
    const uploadUrl = await this.storage.presignPut(key, 'application/pdf');
    return { uploadUrl, key };
  }

  /**
   * Confirma a procuração já enviada ao objeto pré-assinado (§3.2 passo 5, Gherkin
   * "Validação da procuração assinada" / "recusada"): baixa os bytes e valida
   * presença de PAdES + regra PJ→e-CNPJ antes de aceitar.
   */
  async confirmPoa(
    filingId: string,
    customerUserId: string,
    declaredSignerDocType: 'e-cpf' | 'e-cnpj',
    declaredSignerDocNumber: string,
  ): Promise<FilingRow> {
    const filing = await this.requireOwned(filingId, customerUserId);
    if (!canUploadPoa(filing.status)) {
      throw Errors.conflict('Este pedido não está aguardando o envio da procuração.');
    }
    if (!filing.holder) throw Errors.conflict('Preencha os dados de titularidade antes de enviar a procuração.');

    const key = `inpi-filings/${filingId}/procuracao.pdf`;
    const pdfBytes = await this.storage.download(key);
    const sig = await this.signatures.check({ pdfBytes, declaredSignerDocType, declaredSignerDocNumber });
    const validation = validatePoaSignature({
      holderType: filing.holder.type,
      signerDocType: sig.signerDocType,
      hasPadesMarkers: sig.hasPadesMarkers,
    });
    if (!validation.valid) {
      await this.events.record(filingId, 'note', { action: 'poa_rejected', reason: validation.reason });
      throw Errors.conflict(validation.reason!);
    }

    const updated = await this.filings.update(filingId, { poaPdfS3Key: key, status: 'awaiting_payment' });
    await this.events.record(filingId, 'poa_signed', { signerDocType: sig.signerDocType });
    return updated;
  }

  /** Pagamento (honorários + repasse da GRU) — mock: não há gateway real nesta milestone. */
  async confirmPayment(filingId: string, customerUserId: string): Promise<FilingRow> {
    const filing = await this.requireOwned(filingId, customerUserId);
    if (!canConfirmPayment(filing.status)) {
      throw Errors.conflict('Este pedido não está aguardando pagamento.');
    }
    const { serviceFeeCents, gruFeeCents } = this.pricing();
    const updated = await this.filings.update(filingId, {
      status: 'in_review',
      feeCentsService: serviceFeeCents,
      feeCentsGru: gruFeeCents,
    });
    await this.events.record(filingId, 'gru_paid', { serviceFeeCents, gruFeeCents });
    return updated;
  }

  /** Revogação (§3.3, Gherkin "Revogação da procuração") — isenta de custo, a qualquer tempo até a concessão. */
  async revoke(filingId: string, customerUserId: string): Promise<FilingRow> {
    const filing = await this.requireOwned(filingId, customerUserId);
    if (!canRevoke(filing.status)) {
      throw Errors.conflict('Este pedido já foi concedido, rejeitado ou revogado.');
    }
    const updated = await this.filings.update(filingId, { status: 'revoked' });
    await this.events.record(filingId, 'note', { action: 'revoked' });
    await this.webhooks.dispatch(updated.customerUserId, updated.projectId, 'inpi.filing.status_changed', {
      filingId: updated.id,
      status: updated.status,
      kind: 'revoked',
    });
    return updated;
  }

  async getTimeline(filingId: string, customerUserId: string) {
    const filing = await this.requireOwned(filingId, customerUserId);
    const events = await this.events.listForFiling(filingId);
    const [poaUrl, certificateUrl] = await Promise.all([
      filing.poaPdfS3Key ? this.storage.presignGet(filing.poaPdfS3Key) : null,
      filing.certificateS3Key ? this.storage.presignGet(filing.certificateS3Key) : null,
    ]);
    return { filing, events, poaUrl, certificateUrl };
  }

  listMine(customerUserId: string): Promise<FilingRow[]> {
    return this.filings.listForCustomer(customerUserId);
  }

  private async requireOwned(filingId: string, customerUserId: string): Promise<FilingRow> {
    const filing = await this.filings.findById(filingId);
    if (!filing || filing.customerUserId !== customerUserId) throw Errors.notFound('Pedido de registro');
    return filing;
  }
}
