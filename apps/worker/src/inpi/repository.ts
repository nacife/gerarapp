import { Prisma, prisma } from '@eduforge/db';
import type { Manifest } from '@eduforge/schemas';
import type { InpiPackageProgress } from './pipeline';

export interface InpiVersionData {
  appVersionId: string;
  projectId: string;
  slug: string;
  title: string;
  versionNumber: number;
  manifest: Manifest;
  publishedAt: Date;
  projectCreatedAt: Date;
  ownerUserId: string;
  ownerName: string;
}

export class PrismaInpiRepository {
  async getVersionForPackaging(appVersionId: string): Promise<InpiVersionData | null> {
    const version = await prisma.appVersion.findUnique({
      where: { id: appVersionId },
      include: { project: { include: { owner: true } } },
    });
    if (!version || !version.publishedAt) return null;

    return {
      appVersionId: version.id,
      projectId: version.projectId,
      slug: version.project.slug,
      title: version.project.title,
      versionNumber: version.versionNumber,
      manifest: version.manifest as unknown as Manifest,
      publishedAt: version.publishedAt,
      projectCreatedAt: version.project.createdAt,
      ownerUserId: version.project.ownerUserId,
      ownerName: version.project.owner.name,
    };
  }

  async hasCertificate(appVersionId: string): Promise<boolean> {
    const existing = await prisma.inpiCertificate.findUnique({
      where: { appVersionId },
      select: { id: true },
    });
    return existing !== null;
  }

  async saveCertificate(input: {
    appVersionId: string;
    requestedById: string;
    bundleHashSha512: string;
    bundleHashSha256: string;
    manifestCanonicalS3Key: string;
    declarationPdfS3Key: string;
  }): Promise<{ certificateId: string }> {
    const cert = await prisma.inpiCertificate.create({
      data: {
        appVersionId: input.appVersionId,
        requestedById: input.requestedById,
        algorithm: 'SHA-512',
        bundleHash: input.bundleHashSha512,
        bundleHashSha256: input.bundleHashSha256,
        manifestCanonicalS3Key: input.manifestCanonicalS3Key,
        declarationPdfS3Key: input.declarationPdfS3Key,
      },
    });
    return { certificateId: cert.id };
  }

  async saveJob(
    jobId: string,
    patch: { status?: 'running' | 'succeeded' | 'failed'; progress?: InpiPackageProgress; error?: string },
  ): Promise<void> {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: patch.status,
        progress: patch.progress ? (patch.progress as unknown as Prisma.InputJsonValue) : undefined,
        error: patch.error,
      },
    });
  }
}
