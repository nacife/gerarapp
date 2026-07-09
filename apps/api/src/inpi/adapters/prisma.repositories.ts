import { prisma } from '@eduforge/db';
import type {
  InpiCertificateRepository,
  InpiCertificateRow,
  InpiJobRepository,
  InpiOwnedProject,
  InpiProjectRepository,
  InpiVersionRow,
} from '../ports';

export class PrismaInpiProjectRepository implements InpiProjectRepository {
  async findByIdForOwner(id: string, ownerUserId: string): Promise<InpiOwnedProject | null> {
    const project = await prisma.project.findFirst({
      where: { id, ownerUserId },
      include: { owner: { select: { name: true } } },
    });
    if (!project) return null;
    return {
      id: project.id,
      title: project.title,
      slug: project.slug,
      createdAt: project.createdAt,
      ownerName: project.owner.name,
    };
  }

  async listPublishedVersions(projectId: string): Promise<InpiVersionRow[]> {
    const versions = await prisma.appVersion.findMany({
      where: { projectId, publishedAt: { not: null } },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, publishedAt: true },
    });
    return versions.map((v) => ({
      appVersionId: v.id,
      versionNumber: v.versionNumber,
      publishedAt: v.publishedAt!,
    }));
  }

  async getPublishedVersion(projectId: string, versionNumber: number): Promise<InpiVersionRow | null> {
    const version = await prisma.appVersion.findFirst({
      where: { projectId, versionNumber, publishedAt: { not: null } },
      select: { id: true, versionNumber: true, publishedAt: true },
    });
    if (!version) return null;
    return { appVersionId: version.id, versionNumber: version.versionNumber, publishedAt: version.publishedAt! };
  }

  async getLatestPublishedVersion(projectId: string): Promise<InpiVersionRow | null> {
    const version = await prisma.appVersion.findFirst({
      where: { projectId, publishedAt: { not: null } },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, publishedAt: true },
    });
    if (!version) return null;
    return { appVersionId: version.id, versionNumber: version.versionNumber, publishedAt: version.publishedAt! };
  }
}

function toRow(cert: {
  id: string;
  appVersionId: string;
  algorithm: string;
  bundleHash: string;
  bundleHashSha256: string | null;
  manifestCanonicalS3Key: string | null;
  declarationPdfS3Key: string | null;
  tsaTokenS3Key: string | null;
  generatedAt: Date;
  appVersion: {
    versionNumber: number;
    publishedAt: Date | null;
    project: { id: string; ownerUserId: string; title: string; slug: string; createdAt: Date; owner: { name: string } };
  };
  verifications: { matched: boolean; verifiedAt: Date }[];
}): InpiCertificateRow {
  return {
    id: cert.id,
    projectId: cert.appVersion.project.id,
    ownerUserId: cert.appVersion.project.ownerUserId,
    appVersionId: cert.appVersionId,
    versionNumber: cert.appVersion.versionNumber,
    title: cert.appVersion.project.title,
    slug: cert.appVersion.project.slug,
    projectCreatedAt: cert.appVersion.project.createdAt,
    publishedAt: cert.appVersion.publishedAt!,
    holderName: cert.appVersion.project.owner.name,
    algorithm: cert.algorithm,
    bundleHash: cert.bundleHash,
    bundleHashSha256: cert.bundleHashSha256,
    manifestCanonicalS3Key: cert.manifestCanonicalS3Key,
    declarationPdfS3Key: cert.declarationPdfS3Key,
    tsaTokenS3Key: cert.tsaTokenS3Key,
    generatedAt: cert.generatedAt,
    lastVerification: cert.verifications[0] ?? null,
  };
}

const INCLUDE = {
  appVersion: { include: { project: { include: { owner: { select: { name: true } } } } } },
  verifications: { orderBy: { verifiedAt: 'desc' as const }, take: 1 },
};

export class PrismaInpiCertificateRepository implements InpiCertificateRepository {
  async listForProject(projectId: string): Promise<InpiCertificateRow[]> {
    const rows = await prisma.inpiCertificate.findMany({
      where: { appVersion: { projectId } },
      include: INCLUDE,
      orderBy: { generatedAt: 'desc' },
    });
    return rows.map(toRow);
  }

  async findById(id: string): Promise<InpiCertificateRow | null> {
    const row = await prisma.inpiCertificate.findUnique({ where: { id }, include: INCLUDE });
    return row ? toRow(row) : null;
  }

  async findByAppVersionId(appVersionId: string): Promise<InpiCertificateRow | null> {
    const row = await prisma.inpiCertificate.findUnique({ where: { appVersionId }, include: INCLUDE });
    return row ? toRow(row) : null;
  }

  async recordVerification(
    certificateId: string,
    input: { matched: boolean; recomputedHash: string; verifiedById?: string },
  ): Promise<void> {
    await prisma.inpiCertificateVerification.create({
      data: {
        certificateId,
        matched: input.matched,
        recomputedHash: input.recomputedHash,
        verifiedById: input.verifiedById,
      },
    });
  }
}

export class PrismaInpiJobRepository implements InpiJobRepository {
  async create(input: { projectId: string }): Promise<{ id: string }> {
    const job = await prisma.job.create({
      data: {
        type: 'inpi_package',
        projectId: input.projectId,
        status: 'queued',
        progress: {
          current: 'memorial',
          steps: [
            { key: 'memorial', label: 'Gerando memorial descritivo', status: 'pending', pct: 0 },
            { key: 'telas', label: 'Capturando telas do app', status: 'pending', pct: 0 },
            { key: 'pacote', label: 'Montando pacote e calculando hash', status: 'pending', pct: 0 },
            { key: 'upload', label: 'Enviando para armazenamento seguro', status: 'pending', pct: 0 },
          ],
        },
      },
    });
    return { id: job.id };
  }
}
