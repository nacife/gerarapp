import { createHash } from 'node:crypto';
import { buildFichaRegistro, type FichaRegistro } from '@eduforge/schemas';
import { Errors } from '../common/errors';
import type {
  InpiCertificateRepository,
  InpiCertificateRow,
  InpiEnqueuer,
  InpiJobRepository,
  InpiProjectRepository,
  InpiStorage,
} from './ports';

export interface CertificateView extends InpiCertificateRow {
  zipUrl: string | null;
  declarationUrl: string | null;
  tsaUrl: string | null;
  fichaRegistro: FichaRegistro;
}

export class InpiService {
  constructor(
    private readonly projects: InpiProjectRepository,
    private readonly certificates: InpiCertificateRepository,
    private readonly jobs: InpiJobRepository,
    private readonly enqueuer: InpiEnqueuer,
    private readonly storage: InpiStorage,
  ) {}

  /** Gera o Pacote INPI da versão publicada indicada (ou a mais recente) — US-INPI-01. */
  async generatePackage(
    projectId: string,
    ownerUserId: string,
    versionNumber?: number,
  ): Promise<{ jobId: string }> {
    const project = await this.projects.findByIdForOwner(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');

    const version =
      versionNumber != null
        ? await this.projects.getPublishedVersion(projectId, versionNumber)
        : await this.projects.getLatestPublishedVersion(projectId);
    if (!version) throw Errors.appNotPublished();

    const existing = await this.certificates.findByAppVersionId(version.appVersionId);
    if (existing) {
      throw Errors.conflict(
        `A versão ${version.versionNumber} já possui uma certificação INPI (${existing.id}). ` +
          'Publique uma nova versão para gerar um novo registro.',
      );
    }

    const job = await this.jobs.create({ projectId });
    await this.enqueuer.enqueuePackage({
      jobId: job.id,
      appVersionId: version.appVersionId,
      requestedById: ownerUserId,
    });
    return { jobId: job.id };
  }

  async listForProject(projectId: string, ownerUserId: string): Promise<InpiCertificateRow[]> {
    const project = await this.projects.findByIdForOwner(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');
    return this.certificates.listForProject(projectId);
  }

  async getCertificate(id: string, ownerUserId: string): Promise<CertificateView> {
    const cert = await this.requireOwnedCertificate(id, ownerUserId);

    const [zipUrl, declarationUrl, tsaUrl] = await Promise.all([
      cert.manifestCanonicalS3Key ? this.storage.presignGet(cert.manifestCanonicalS3Key) : null,
      cert.declarationPdfS3Key ? this.storage.presignGet(cert.declarationPdfS3Key) : null,
      cert.tsaTokenS3Key ? this.storage.presignGet(cert.tsaTokenS3Key) : null,
    ]);

    const fichaRegistro = buildFichaRegistro({
      title: cert.title,
      slug: cert.slug,
      versionNumber: cert.versionNumber,
      createdAt: cert.projectCreatedAt,
      publishedAt: cert.publishedAt,
      holderName: cert.holderName,
      algorithm: cert.algorithm,
    });

    return { ...cert, zipUrl, declarationUrl, tsaUrl, fichaRegistro };
  }

  /** Recalcula o hash do ZIP congelado e compara com o registrado (RF-16.4). */
  async verify(
    id: string,
    ownerUserId: string,
    verifiedById: string,
  ): Promise<{ matched: boolean; verifiedAt: Date; recomputedHash: string }> {
    const cert = await this.requireOwnedCertificate(id, ownerUserId);
    if (!cert.manifestCanonicalS3Key) {
      throw Errors.conflict('O pacote ainda não está disponível para verificação.');
    }

    const bytes = await this.storage.download(cert.manifestCanonicalS3Key);
    const recomputedHash = createHash('sha512').update(bytes).digest('hex');
    const matched = recomputedHash === cert.bundleHash;
    const verifiedAt = new Date();

    await this.certificates.recordVerification(id, { matched, recomputedHash, verifiedById });

    return { matched, verifiedAt, recomputedHash };
  }

  private async requireOwnedCertificate(id: string, ownerUserId: string): Promise<InpiCertificateRow> {
    const cert = await this.certificates.findById(id);
    if (!cert || cert.ownerUserId !== ownerUserId) throw Errors.notFound('Certificado');
    return cert;
  }
}
