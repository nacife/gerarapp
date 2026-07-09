import { randomUUID } from 'node:crypto';
import type {
  FilingCertificateInfo,
  FilingCertificateRepository,
  FilingEventKind,
  FilingEventRepository,
  FilingEventRow,
  FilingPatch,
  FilingRepository,
  FilingRow,
  FilingStatus,
  FilingStorage,
} from '../ports';
import type { SignatureCheckInput, SignatureCheckResult, SignatureValidator } from '../signature-validator';

export class InMemoryFilingRepository implements FilingRepository {
  rows: FilingRow[] = [];

  async create(input: { inpiCertificateId: string; customerUserId: string }): Promise<FilingRow> {
    const row: FilingRow = {
      id: randomUUID(),
      inpiCertificateId: input.inpiCertificateId,
      customerUserId: input.customerUserId,
      mode: 'assisted',
      status: 'draft',
      holder: null,
      authors: null,
      poaPdfS3Key: null,
      gruNumber: null,
      inpiProcessNumber: null,
      certificateS3Key: null,
      feeCentsService: null,
      feeCentsGru: null,
      operatorChecklist: null,
      assignedOperator: null,
      filedAt: null,
      grantedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: 'project-1',
      projectTitle: 'Biologia Viva',
      projectSlug: 'biologia-viva',
      versionNumber: 3,
      customerName: 'Marina (criadora)',
      customerEmail: 'marina@exemplo.com',
    };
    this.rows.push(row);
    return { ...row };
  }

  async findById(id: string): Promise<FilingRow | null> {
    const r = this.rows.find((x) => x.id === id);
    return r ? { ...r } : null;
  }

  async update(id: string, patch: FilingPatch): Promise<FilingRow> {
    const r = this.rows.find((x) => x.id === id);
    if (!r) throw new Error('filing não encontrado (fake)');
    Object.assign(r, patch);
    r.updatedAt = new Date();
    return { ...r };
  }

  async listForCustomer(customerUserId: string): Promise<FilingRow[]> {
    return this.rows.filter((r) => r.customerUserId === customerUserId).map((r) => ({ ...r }));
  }

  async listForQueue(status?: FilingStatus): Promise<FilingRow[]> {
    return this.rows
      .filter((r) => (status ? r.status === status : !['granted', 'rejected', 'revoked'].includes(r.status)))
      .map((r) => ({ ...r }));
  }
}

export class InMemoryFilingEventRepository implements FilingEventRepository {
  rows: (FilingEventRow & { filingId: string })[] = [];

  async record(filingId: string, kind: FilingEventKind, detail?: unknown): Promise<void> {
    this.rows.push({ id: randomUUID(), filingId, kind, detail: detail ?? null, occurredAt: new Date() });
  }

  async listForFiling(filingId: string): Promise<FilingEventRow[]> {
    return this.rows.filter((r) => r.filingId === filingId).map(({ filingId: _f, ...rest }) => rest);
  }
}

export class InMemoryFilingCertificateRepository implements FilingCertificateRepository {
  certs: FilingCertificateInfo[] = [];

  seed(overrides: Partial<FilingCertificateInfo> = {}): FilingCertificateInfo {
    const cert: FilingCertificateInfo = {
      certificateId: overrides.certificateId ?? randomUUID(),
      projectId: overrides.projectId ?? 'project-1',
      ownerUserId: overrides.ownerUserId ?? 'owner-1',
      ownerName: overrides.ownerName ?? 'Marina (criadora)',
      ownerEmail: overrides.ownerEmail ?? 'marina@exemplo.com',
      versionNumber: overrides.versionNumber ?? 3,
      title: overrides.title ?? 'Biologia Viva',
      slug: overrides.slug ?? 'biologia-viva',
    };
    this.certs.push(cert);
    return cert;
  }

  async getForOwner(certificateId: string, ownerUserId: string): Promise<FilingCertificateInfo | null> {
    const c = this.certs.find((x) => x.certificateId === certificateId && x.ownerUserId === ownerUserId);
    return c ? { ...c } : null;
  }

  async getById(certificateId: string): Promise<FilingCertificateInfo | null> {
    const c = this.certs.find((x) => x.certificateId === certificateId);
    return c ? { ...c } : null;
  }
}

export class FakeFilingStorage implements FilingStorage {
  files = new Map<string, Buffer>();

  /** Simula o PUT direto ao objeto pré-assinado — usado nos testes para "subir" a procuração. */
  seedUpload(key: string, bytes: Buffer) {
    this.files.set(key, bytes);
  }

  async presignPut(key: string): Promise<string> {
    return `https://minio.local/${key}?signature=fake-put`;
  }
  async download(key: string): Promise<Buffer> {
    const buf = this.files.get(key);
    if (!buf) throw new Error(`objeto não encontrado (fake): ${key}`);
    return buf;
  }
  async presignGet(key: string): Promise<string> {
    return `https://minio.local/${key}?signature=fake`;
  }
}

export class FakeSignatureValidator implements SignatureValidator {
  /** Permite forçar o resultado em testes específicos; por padrão delega ao scan real. */
  forcedResult: SignatureCheckResult | null = null;

  async check(input: SignatureCheckInput): Promise<SignatureCheckResult> {
    if (this.forcedResult) return this.forcedResult;
    const hasPadesMarkers = input.pdfBytes.includes('PADES_OK');
    return {
      hasPadesMarkers,
      trusted: hasPadesMarkers,
      signerDocType: input.declaredSignerDocType,
      signerDocNumber: input.declaredSignerDocNumber,
    };
  }
}
