import { randomUUID } from 'node:crypto';
import type { SourceMimeKey } from '../domain/source-file';
import type {
  ContentMapRecord,
  ContentMapRepository,
  IngestEnqueuer,
  JobProgress,
  JobRecord,
  JobRepository,
  ProjectRecord,
  ProjectRepository,
  SourceFileRecord,
  SourceFileRepository,
  Storage,
} from '../ports';
import type { ContentMapTree } from '@eduforge/schemas';

export class InMemoryProjectRepository implements ProjectRepository {
  projects: ProjectRecord[] = [];

  seedProject(ownerUserId: string): ProjectRecord {
    const rec: ProjectRecord = {
      id: randomUUID(),
      ownerUserId,
      orgId: null,
      title: 'Biologia',
      slug: `biologia-${randomUUID().slice(0, 6)}`,
      status: 'draft',
      accessMode: 'public',
      createdAt: new Date(),
    };
    this.projects.push(rec);
    return rec;
  }
  async create(input: { ownerUserId: string; title: string; slug: string }): Promise<ProjectRecord> {
    const rec: ProjectRecord = {
      id: randomUUID(),
      ownerUserId: input.ownerUserId,
      orgId: null,
      title: input.title,
      slug: input.slug,
      status: 'draft',
      accessMode: 'public',
      createdAt: new Date(),
    };
    this.projects.push(rec);
    return rec;
  }
  async listByOwner(ownerUserId: string): Promise<ProjectRecord[]> {
    return this.projects.filter((p) => p.ownerUserId === ownerUserId);
  }
  async findByIdForOwner(id: string, ownerUserId: string): Promise<ProjectRecord | null> {
    return this.projects.find((p) => p.id === id && p.ownerUserId === ownerUserId) ?? null;
  }
  async slugExists(slug: string): Promise<boolean> {
    return this.projects.some((p) => p.slug === slug);
  }
}

export class InMemorySourceFileRepository implements SourceFileRepository {
  files: (SourceFileRecord & { ownerUserId: string })[] = [];
  constructor(private readonly projects: InMemoryProjectRepository) {}

  async create(input: {
    projectId: string;
    s3Key: string;
    mime: SourceMimeKey;
    sizeBytes: number;
    sha256: string;
  }): Promise<SourceFileRecord> {
    const owner = this.projects.projects.find((p) => p.id === input.projectId)?.ownerUserId ?? '';
    const rec = { id: randomUUID(), ocrStatus: 'not_needed', ownerUserId: owner, ...input };
    this.files.push(rec);
    return rec;
  }
  async findByIdWithOwner(
    id: string,
  ): Promise<(SourceFileRecord & { ownerUserId: string }) | null> {
    return this.files.find((f) => f.id === id) ?? null;
  }
}

export class InMemoryJobRepository implements JobRepository {
  jobs: (JobRecord & { ownerUserId: string | null })[] = [];

  async create(input: {
    type: 'ingest' | 'generate';
    projectId: string;
    refId?: string;
    progress: JobProgress;
  }): Promise<JobRecord> {
    const rec = {
      id: randomUUID(),
      type: input.type,
      status: 'queued',
      projectId: input.projectId,
      refId: input.refId ?? null,
      progress: input.progress,
      error: null,
      ownerUserId: null,
    };
    this.jobs.push(rec);
    return rec;
  }
  async findByIdWithOwner(
    id: string,
  ): Promise<(JobRecord & { ownerUserId: string | null }) | null> {
    return this.jobs.find((j) => j.id === id) ?? null;
  }
}

export class InMemoryContentMapRepository implements ContentMapRepository {
  maps: ContentMapRecord[] = [];

  async latestForProject(projectId: string): Promise<ContentMapRecord | null> {
    return (
      this.maps
        .filter((m) => m.projectId === projectId)
        .sort((a, b) => b.revision - a.revision)[0] ?? null
    );
  }
  async createRevision(input: {
    projectId: string;
    tree: ContentMapTree;
    structureConfidence: number | null;
  }): Promise<ContentMapRecord> {
    const last = await this.latestForProject(input.projectId);
    const rec: ContentMapRecord = {
      id: randomUUID(),
      projectId: input.projectId,
      revision: (last?.revision ?? 0) + 1,
      tree: input.tree,
      structureConfidence: input.structureConfidence,
      approvedAt: null,
    };
    this.maps.push(rec);
    return rec;
  }
  async approveLatest(projectId: string, at: Date): Promise<ContentMapRecord | null> {
    const last = await this.latestForProject(projectId);
    if (!last) return null;
    last.approvedAt = at;
    return last;
  }
}

export class FakeStorage implements Storage {
  calls: string[] = [];
  async presignPut(key: string): Promise<{ url: string; key: string }> {
    this.calls.push(key);
    return { url: `https://minio.local/${key}?signature=fake`, key };
  }
}

export class FakeIngestEnqueuer implements IngestEnqueuer {
  enqueued: { jobId: string; sourceFileId: string; projectId: string }[] = [];
  async enqueueIngest(input: {
    jobId: string;
    sourceFileId: string;
    projectId: string;
  }): Promise<void> {
    this.enqueued.push(input);
  }
}
