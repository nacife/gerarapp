import type { ContentMapTree } from '@eduforge/schemas';
import type { SourceMimeKey } from './domain/source-file';

export interface ProjectRecord {
  id: string;
  ownerUserId: string;
  orgId: string | null;
  title: string;
  slug: string;
  status: string;
  accessMode: string;
  createdAt: Date;
}

export interface ProjectRepository {
  create(input: { ownerUserId: string; title: string; slug: string }): Promise<ProjectRecord>;
  listByOwner(ownerUserId: string): Promise<ProjectRecord[]>;
  findByIdForOwner(id: string, ownerUserId: string): Promise<ProjectRecord | null>;
  slugExists(slug: string): Promise<boolean>;
}

export interface SourceFileRecord {
  id: string;
  projectId: string;
  s3Key: string;
  mime: SourceMimeKey;
  sizeBytes: number;
  sha256: string;
  ocrStatus: string;
}

export interface SourceFileRepository {
  create(input: {
    projectId: string;
    s3Key: string;
    mime: SourceMimeKey;
    sizeBytes: number;
    sha256: string;
  }): Promise<SourceFileRecord>;
  findByIdWithOwner(
    id: string,
  ): Promise<(SourceFileRecord & { ownerUserId: string }) | null>;
}

export interface JobStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done';
  pct: number;
}

export interface JobProgress {
  current: string;
  steps: JobStep[];
}

export interface JobRecord {
  id: string;
  type: string;
  status: string;
  projectId: string | null;
  refId: string | null;
  progress: JobProgress | null;
  error: string | null;
}

export interface JobRepository {
  create(input: {
    type: 'ingest' | 'generate';
    projectId: string;
    refId?: string;
    progress: JobProgress;
  }): Promise<JobRecord>;
  findByIdWithOwner(id: string): Promise<(JobRecord & { ownerUserId: string | null }) | null>;
}

export interface ContentMapRecord {
  id: string;
  projectId: string;
  revision: number;
  tree: ContentMapTree;
  structureConfidence: number | null;
  approvedAt: Date | null;
}

export interface ContentMapRepository {
  latestForProject(projectId: string): Promise<ContentMapRecord | null>;
  createRevision(input: {
    projectId: string;
    tree: ContentMapTree;
    structureConfidence: number | null;
  }): Promise<ContentMapRecord>;
  approveLatest(projectId: string, at: Date): Promise<ContentMapRecord | null>;
}

export interface Storage {
  /** Gera uma URL pré-assinada de PUT para upload direto (MinIO/S3). */
  presignPut(key: string, contentType: string): Promise<{ url: string; key: string }>;
}

export interface IngestEnqueuer {
  enqueueIngest(input: { jobId: string; sourceFileId: string; projectId: string }): Promise<void>;
}
