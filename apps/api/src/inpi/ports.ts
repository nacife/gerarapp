export interface InpiOwnedProject {
  id: string;
  title: string;
  slug: string;
  createdAt: Date;
  ownerName: string;
}

export interface InpiVersionRow {
  appVersionId: string;
  versionNumber: number;
  publishedAt: Date;
}

export interface InpiProjectRepository {
  findByIdForOwner(id: string, ownerUserId: string): Promise<InpiOwnedProject | null>;
  listPublishedVersions(projectId: string): Promise<InpiVersionRow[]>;
  getPublishedVersion(projectId: string, versionNumber: number): Promise<InpiVersionRow | null>;
  getLatestPublishedVersion(projectId: string): Promise<InpiVersionRow | null>;
}

export interface InpiVerificationSummary {
  matched: boolean;
  verifiedAt: Date;
}

export interface InpiCertificateRow {
  id: string;
  projectId: string;
  ownerUserId: string;
  appVersionId: string;
  versionNumber: number;
  title: string;
  slug: string;
  projectCreatedAt: Date;
  publishedAt: Date;
  holderName: string;
  algorithm: string;
  bundleHash: string;
  bundleHashSha256: string | null;
  manifestCanonicalS3Key: string | null;
  declarationPdfS3Key: string | null;
  tsaTokenS3Key: string | null;
  generatedAt: Date;
  lastVerification: InpiVerificationSummary | null;
}

export interface InpiCertificateRepository {
  listForProject(projectId: string): Promise<InpiCertificateRow[]>;
  findById(id: string): Promise<InpiCertificateRow | null>;
  findByAppVersionId(appVersionId: string): Promise<InpiCertificateRow | null>;
  recordVerification(
    certificateId: string,
    input: { matched: boolean; recomputedHash: string; verifiedById?: string },
  ): Promise<void>;
}

export interface InpiJobRepository {
  create(input: { projectId: string }): Promise<{ id: string }>;
}

export interface InpiEnqueuer {
  enqueuePackage(input: { jobId: string; appVersionId: string; requestedById: string }): Promise<void>;
}

export interface InpiStorage {
  presignGet(key: string): Promise<string>;
  download(key: string): Promise<Buffer>;
}
