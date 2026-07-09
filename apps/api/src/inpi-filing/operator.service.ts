import type { AuditService } from '../admin/audit.service';
import { Errors } from '../common/errors';
import type { WebhooksService } from '../webhooks/webhooks.service';
import { canGrant, canProtocol, canReject, canRecordRpiEvent, canRunChecklist } from './domain/state';
import type { FilingEventRepository, FilingRepository, FilingRow, FilingStatus, FilingStorage } from './ports';

export interface OperatorActor {
  id: string;
  role: string;
}

const SLA_DAYS = 5;

export interface QueueRow extends FilingRow {
  slaDueAt: Date | null;
  slaAtRisk: boolean;
}

function computeSla(filing: FilingRow): { slaDueAt: Date | null; slaAtRisk: boolean } {
  // SLA interno (§3.3): protocolo em até 5 dias úteis após procuração válida + pagamento
  // (aproximado como dias corridos aqui — a distinção "dias úteis" fica para uma
  // implementação futura com calendário de feriados; a métrica de risco já é útil sem ela).
  if (filing.status !== 'in_review' || !filing.updatedAt) return { slaDueAt: null, slaAtRisk: false };
  const dueAt = new Date(filing.updatedAt.getTime() + SLA_DAYS * 24 * 60 * 60 * 1000);
  return { slaDueAt: dueAt, slaAtRisk: dueAt.getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000 };
}

/** Fila operacional do INPI no Admin (RF-17, wireframe C.6). Toda ação é auditada. */
export class OperatorService {
  constructor(
    private readonly filings: FilingRepository,
    private readonly events: FilingEventRepository,
    private readonly storage: FilingStorage,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  private async notifyStatusChanged(filing: FilingRow, extra: Record<string, unknown> = {}): Promise<void> {
    await this.webhooks.dispatch(filing.customerUserId, filing.projectId, 'inpi.filing.status_changed', {
      filingId: filing.id,
      status: filing.status,
      ...extra,
    });
  }

  async listQueue(status?: FilingStatus): Promise<QueueRow[]> {
    const rows = await this.filings.listForQueue(status);
    return rows.map((r) => ({ ...r, ...computeSla(r) }));
  }

  async getDetail(filingId: string) {
    const filing = await this.get(filingId);
    const events = await this.events.listForFiling(filingId);
    const [poaUrl, certificateUrl] = await Promise.all([
      filing.poaPdfS3Key ? this.storage.presignGet(filing.poaPdfS3Key) : null,
      filing.certificateS3Key ? this.storage.presignGet(filing.certificateS3Key) : null,
    ]);
    return { filing, events, poaUrl, certificateUrl, ...computeSla(filing) };
  }

  async claim(actor: OperatorActor, filingId: string): Promise<FilingRow> {
    const filing = await this.get(filingId);
    const updated = await this.filings.update(filingId, { assignedOperator: actor.id });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'inpi_filing.claim',
      targetType: 'inpi_filing',
      targetId: filingId,
      beforeAfter: { before: { assignedOperator: filing.assignedOperator }, after: { assignedOperator: actor.id } },
    });
    return updated;
  }

  /** Checklist manual (C.6): só os 2 itens que não são deriváveis de outro campo. */
  async updateChecklist(
    actor: OperatorActor,
    filingId: string,
    patch: { dvSigned?: boolean; doubleChecked?: boolean; doubleCheckedBy?: string },
  ): Promise<FilingRow> {
    const filing = await this.get(filingId);
    if (!canRunChecklist(filing.status)) {
      throw Errors.conflict('O checklist só pode ser preenchido com o pedido em conferência.');
    }
    const before = filing.operatorChecklist ?? { dvSigned: false, doubleChecked: false };
    const after = { ...before, ...patch };
    const updated = await this.filings.update(filingId, { operatorChecklist: after });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'inpi_filing.checklist_update',
      targetType: 'inpi_filing',
      targetId: filingId,
      beforeAfter: { before, after },
    });
    return updated;
  }

  /** Protocolo no e-Software (§3.2 passo 6, Gherkin "Execução e protocolo pela equipe"). */
  async protocol(
    actor: OperatorActor,
    filingId: string,
    input: { gruNumber: string; inpiProcessNumber: string },
  ): Promise<FilingRow> {
    const filing = await this.get(filingId);
    if (!canProtocol(filing.status)) {
      throw Errors.conflict('Este pedido não está pronto para protocolo (verifique o checklist).');
    }
    const checklist = filing.operatorChecklist;
    if (!checklist?.dvSigned || !checklist?.doubleChecked) {
      throw Errors.conflict('Complete o checklist (DV assinada e dupla conferência) antes de protocolar.');
    }

    const filedAt = new Date();
    const updated = await this.filings.update(filingId, {
      status: 'filed',
      gruNumber: input.gruNumber,
      inpiProcessNumber: input.inpiProcessNumber,
      filedAt,
    });
    await this.events.record(filingId, 'filed', { gruNumber: input.gruNumber, inpiProcessNumber: input.inpiProcessNumber });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'inpi_filing.protocol',
      targetType: 'inpi_filing',
      targetId: filingId,
      beforeAfter: { after: input },
    });
    await this.notifyStatusChanged(updated, { kind: 'filed' });
    return updated;
  }

  /** Acompanhamento da RPI (§3.2 passo 7) — registrado manualmente pelo operador nesta milestone. */
  async recordRpiEvent(actor: OperatorActor, filingId: string, note: string): Promise<void> {
    const filing = await this.get(filingId);
    if (!canRecordRpiEvent(filing.status)) {
      throw Errors.conflict('Este pedido ainda não foi protocolado.');
    }
    await this.events.record(filingId, 'rpi_dispatch', { note });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'inpi_filing.rpi_event',
      targetType: 'inpi_filing',
      targetId: filingId,
      beforeAfter: { after: { note } },
    });
    await this.notifyStatusChanged(filing, { kind: 'rpi_dispatch', note });
  }

  /** URL pré-assinada para o operador enviar o Certificado de Registro baixado do INPI. */
  async certificateUploadUrl(filingId: string): Promise<{ uploadUrl: string; key: string }> {
    const filing = await this.get(filingId);
    if (!canGrant(filing.status)) {
      throw Errors.conflict('Este pedido ainda não foi protocolado.');
    }
    const key = `inpi-filings/${filingId}/certificado-registro.pdf`;
    const uploadUrl = await this.storage.presignPut(key, 'application/pdf');
    return { uploadUrl, key };
  }

  /** Entrega do Certificado de Registro (§3.2 passo 8) — confirma o objeto já enviado. */
  async grant(actor: OperatorActor, filingId: string): Promise<FilingRow> {
    const filing = await this.get(filingId);
    if (!canGrant(filing.status)) {
      throw Errors.conflict('Este pedido ainda não foi protocolado.');
    }
    const key = `inpi-filings/${filingId}/certificado-registro.pdf`;
    const grantedAt = new Date();
    const updated = await this.filings.update(filingId, { status: 'granted', certificateS3Key: key, grantedAt });
    await this.events.record(filingId, 'granted', {});
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'inpi_filing.grant',
      targetType: 'inpi_filing',
      targetId: filingId,
      beforeAfter: { after: { certificateS3Key: key } },
    });
    await this.notifyStatusChanged(updated, { kind: 'granted' });
    return updated;
  }

  async reject(actor: OperatorActor, filingId: string, reason: string): Promise<FilingRow> {
    const filing = await this.get(filingId);
    if (!canReject(filing.status)) {
      throw Errors.conflict('Este pedido não pode mais ser rejeitado.');
    }
    const updated = await this.filings.update(filingId, { status: 'rejected' });
    await this.events.record(filingId, 'note', { action: 'rejected', reason });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'inpi_filing.reject',
      targetType: 'inpi_filing',
      targetId: filingId,
      beforeAfter: { after: { reason } },
    });
    await this.notifyStatusChanged(updated, { kind: 'rejected', reason });
    return updated;
  }

  private async get(filingId: string): Promise<FilingRow> {
    const filing = await this.filings.findById(filingId);
    if (!filing) throw Errors.notFound('Pedido de registro');
    return filing;
  }
}
