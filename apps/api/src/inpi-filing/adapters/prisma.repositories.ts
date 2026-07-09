import { Prisma, prisma } from '@eduforge/db';
import type {
  AuthorInfo,
  FilingCertificateInfo,
  FilingCertificateRepository,
  FilingEventKind,
  FilingEventRepository,
  FilingEventRow,
  FilingPatch,
  FilingRepository,
  FilingRow,
  FilingStatus,
  HolderInfo,
  OperatorChecklist,
} from '../ports';

const INCLUDE = {
  customer: { select: { name: true, email: true } },
  inpiCertificate: {
    include: { appVersion: { include: { project: { select: { id: true, title: true, slug: true } } } } },
  },
};

type PrismaFilingWithIncludes = Prisma.InpiFilingGetPayload<{ include: typeof INCLUDE }>;

function toRow(f: PrismaFilingWithIncludes): FilingRow {
  return {
    id: f.id,
    inpiCertificateId: f.inpiCertificateId,
    customerUserId: f.customerUserId,
    mode: f.mode,
    status: f.status as FilingStatus,
    holder: (f.holder as unknown as HolderInfo) ?? null,
    authors: (f.authors as unknown as AuthorInfo[]) ?? null,
    poaPdfS3Key: f.poaPdfS3Key,
    gruNumber: f.gruNumber,
    inpiProcessNumber: f.inpiProcessNumber,
    certificateS3Key: f.certificateS3Key,
    feeCentsService: f.feeCentsService,
    feeCentsGru: f.feeCentsGru,
    operatorChecklist: (f.operatorChecklist as unknown as OperatorChecklist) ?? null,
    assignedOperator: f.assignedOperator,
    filedAt: f.filedAt,
    grantedAt: f.grantedAt,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    projectId: f.inpiCertificate!.appVersion.project.id,
    projectTitle: f.inpiCertificate!.appVersion.project.title,
    projectSlug: f.inpiCertificate!.appVersion.project.slug,
    versionNumber: f.inpiCertificate!.appVersion.versionNumber,
    customerName: f.customer.name,
    customerEmail: f.customer.email,
  };
}

export class PrismaFilingRepository implements FilingRepository {
  async create(input: { inpiCertificateId: string; customerUserId: string }): Promise<FilingRow> {
    const created = await prisma.inpiFiling.create({
      data: {
        inpiCertificateId: input.inpiCertificateId,
        customerUserId: input.customerUserId,
        mode: 'assisted',
        status: 'draft',
      },
      include: INCLUDE,
    });
    return toRow(created);
  }

  async findById(id: string): Promise<FilingRow | null> {
    const found = await prisma.inpiFiling.findUnique({ where: { id }, include: INCLUDE });
    return found ? toRow(found) : null;
  }

  async update(id: string, patch: FilingPatch): Promise<FilingRow> {
    const updated = await prisma.inpiFiling.update({
      where: { id },
      data: {
        status: patch.status,
        holder: patch.holder as unknown as Prisma.InputJsonValue,
        authors: patch.authors as unknown as Prisma.InputJsonValue,
        poaPdfS3Key: patch.poaPdfS3Key,
        gruNumber: patch.gruNumber,
        inpiProcessNumber: patch.inpiProcessNumber,
        certificateS3Key: patch.certificateS3Key,
        feeCentsService: patch.feeCentsService,
        feeCentsGru: patch.feeCentsGru,
        operatorChecklist: patch.operatorChecklist as unknown as Prisma.InputJsonValue,
        assignedOperator: patch.assignedOperator,
        filedAt: patch.filedAt,
        grantedAt: patch.grantedAt,
      },
      include: INCLUDE,
    });
    return toRow(updated);
  }

  async listForCustomer(customerUserId: string): Promise<FilingRow[]> {
    const rows = await prisma.inpiFiling.findMany({
      where: { customerUserId },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRow);
  }

  async listForQueue(status?: FilingStatus): Promise<FilingRow[]> {
    const rows = await prisma.inpiFiling.findMany({
      where: status ? { status } : { status: { notIn: ['granted', 'rejected', 'revoked'] } },
      include: INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRow);
  }
}

export class PrismaFilingEventRepository implements FilingEventRepository {
  async record(filingId: string, kind: FilingEventKind, detail?: unknown): Promise<void> {
    await prisma.inpiFilingEvent.create({
      data: { filingId, kind, detail: (detail ?? null) as unknown as Prisma.InputJsonValue },
    });
  }

  async listForFiling(filingId: string): Promise<FilingEventRow[]> {
    const rows = await prisma.inpiFilingEvent.findMany({
      where: { filingId },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, kind: r.kind as FilingEventKind, detail: r.detail, occurredAt: r.occurredAt }));
  }
}

export class PrismaFilingCertificateRepository implements FilingCertificateRepository {
  async getForOwner(certificateId: string, ownerUserId: string): Promise<FilingCertificateInfo | null> {
    const cert = await this.getById(certificateId);
    return cert && cert.ownerUserId === ownerUserId ? cert : null;
  }

  async getById(certificateId: string): Promise<FilingCertificateInfo | null> {
    const cert = await prisma.inpiCertificate.findUnique({
      where: { id: certificateId },
      include: { appVersion: { include: { project: { include: { owner: true } } } } },
    });
    if (!cert) return null;
    return {
      certificateId: cert.id,
      projectId: cert.appVersion.project.id,
      ownerUserId: cert.appVersion.project.ownerUserId,
      ownerName: cert.appVersion.project.owner.name,
      ownerEmail: cert.appVersion.project.owner.email,
      versionNumber: cert.appVersion.versionNumber,
      title: cert.appVersion.project.title,
      slug: cert.appVersion.project.slug,
    };
  }
}
