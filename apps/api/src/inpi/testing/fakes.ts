import { randomUUID } from 'node:crypto';
import type {
  InpiCertificateRepository,
  InpiCertificateRow,
  InpiEnqueuer,
  InpiJobRepository,
  InpiOwnedProject,
  InpiProjectRepository,
  InpiStorage,
  InpiVersionRow,
} from '../ports';

export class InMemoryInpiProjectRepository implements InpiProjectRepository {
  projects: (InpiOwnedProject & { ownerUserId: string })[] = [];
  versions: (InpiVersionRow & { projectId: string })[] = [];

  seedProject(ownerUserId: string, overrides: Partial<InpiOwnedProject> = {}): InpiOwnedProject {
    const project = {
      id: overrides.id ?? randomUUID(),
      title: overrides.title ?? 'Biologia Viva',
      slug: overrides.slug ?? 'biologia-viva',
      createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00Z'),
      ownerName: overrides.ownerName ?? 'Marina (criadora)',
      ownerUserId,
    };
    this.projects.push(project);
    return project;
  }

  seedPublishedVersion(projectId: string, versionNumber: number, publishedAt = new Date('2026-06-01T00:00:00Z')) {
    const row = { appVersionId: randomUUID(), projectId, versionNumber, publishedAt };
    this.versions.push(row);
    return row;
  }

  async findByIdForOwner(id: string, ownerUserId: string): Promise<InpiOwnedProject | null> {
    const p = this.projects.find((x) => x.id === id && x.ownerUserId === ownerUserId);
    return p ? { ...p } : null;
  }

  async listPublishedVersions(projectId: string): Promise<InpiVersionRow[]> {
    return this.versions.filter((v) => v.projectId === projectId).map((v) => ({ ...v }));
  }

  async getPublishedVersion(projectId: string, versionNumber: number): Promise<InpiVersionRow | null> {
    const v = this.versions.find((x) => x.projectId === projectId && x.versionNumber === versionNumber);
    return v ? { ...v } : null;
  }

  async getLatestPublishedVersion(projectId: string): Promise<InpiVersionRow | null> {
    const matches = this.versions.filter((v) => v.projectId === projectId);
    if (matches.length === 0) return null;
    return { ...matches.reduce((a, b) => (b.versionNumber > a.versionNumber ? b : a)) };
  }
}

export class InMemoryInpiCertificateRepository implements InpiCertificateRepository {
  rows: (InpiCertificateRow & { verificationsLog: { matched: boolean; verifiedAt: Date }[] })[] = [];

  seed(input: Partial<InpiCertificateRow> & { appVersionId: string; projectId: string; ownerUserId: string }) {
    const row = {
      id: input.id ?? randomUUID(),
      projectId: input.projectId,
      ownerUserId: input.ownerUserId,
      appVersionId: input.appVersionId,
      versionNumber: input.versionNumber ?? 1,
      title: input.title ?? 'Biologia Viva',
      slug: input.slug ?? 'biologia-viva',
      projectCreatedAt: input.projectCreatedAt ?? new Date('2026-01-01T00:00:00Z'),
      publishedAt: input.publishedAt ?? new Date('2026-06-01T00:00:00Z'),
      holderName: input.holderName ?? 'Marina (criadora)',
      algorithm: input.algorithm ?? 'SHA-512',
      bundleHash: input.bundleHash ?? 'a'.repeat(128),
      bundleHashSha256: input.bundleHashSha256 ?? 'b'.repeat(64),
      manifestCanonicalS3Key: input.manifestCanonicalS3Key ?? 'inpi/pkg.zip',
      declarationPdfS3Key: input.declarationPdfS3Key ?? 'inpi/declaracao.pdf',
      tsaTokenS3Key: input.tsaTokenS3Key ?? null,
      generatedAt: input.generatedAt ?? new Date('2026-06-02T00:00:00Z'),
      lastVerification: null,
      verificationsLog: [],
    };
    this.rows.push(row);
    return row;
  }

  async listForProject(projectId: string): Promise<InpiCertificateRow[]> {
    return this.rows.filter((r) => r.projectId === projectId).map((r) => ({ ...r }));
  }

  async findById(id: string): Promise<InpiCertificateRow | null> {
    const r = this.rows.find((x) => x.id === id);
    return r ? { ...r } : null;
  }

  async findByAppVersionId(appVersionId: string): Promise<InpiCertificateRow | null> {
    const r = this.rows.find((x) => x.appVersionId === appVersionId);
    return r ? { ...r } : null;
  }

  async recordVerification(
    certificateId: string,
    input: { matched: boolean; recomputedHash: string; verifiedById?: string },
  ): Promise<void> {
    const r = this.rows.find((x) => x.id === certificateId);
    if (!r) return;
    const entry = { matched: input.matched, verifiedAt: new Date() };
    r.verificationsLog.unshift(entry);
    r.lastVerification = entry;
  }
}

export class InMemoryInpiJobRepository implements InpiJobRepository {
  created: { id: string; projectId: string }[] = [];
  async create(input: { projectId: string }): Promise<{ id: string }> {
    const id = randomUUID();
    this.created.push({ id, projectId: input.projectId });
    return { id };
  }
}

export class FakeInpiEnqueuer implements InpiEnqueuer {
  enqueued: { jobId: string; appVersionId: string; requestedById: string }[] = [];
  async enqueuePackage(input: { jobId: string; appVersionId: string; requestedById: string }): Promise<void> {
    this.enqueued.push(input);
  }
}

export class FakeInpiStorage implements InpiStorage {
  files = new Map<string, Buffer>();
  seedFile(key: string, content: Buffer) {
    this.files.set(key, content);
  }
  async presignGet(key: string): Promise<string> {
    return `https://minio.local/${key}?signature=fake`;
  }
  async download(key: string): Promise<Buffer> {
    const buf = this.files.get(key);
    if (!buf) throw new Error(`objeto não encontrado: ${key}`);
    return buf;
  }
}
