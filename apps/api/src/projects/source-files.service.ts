import { randomUUID } from 'node:crypto';
import { Errors } from '../common/errors';
import {
  CONTENT_TYPE_BY_MIME,
  sanitizeFilename,
  validateUpload,
} from './domain/source-file';
import type {
  IngestEnqueuer,
  JobStep,
  ProjectRepository,
  SourceFileRepository,
  JobRepository,
  Storage,
} from './ports';

/** Etapas iniciais do job de ingestão (rótulos do wireframe C.2). */
export const INGEST_STEPS: JobStep[] = [
  { key: 'extract', label: 'Extraindo', status: 'pending', pct: 0 },
  { key: 'structure', label: 'Estruturando', status: 'pending', pct: 0 },
  { key: 'classify', label: 'Classificando', status: 'pending', pct: 0 },
];

export interface InitiateUploadInput {
  filename: string;
  contentType?: string;
  sizeBytes: number;
  sha256: string;
}

export class SourceFilesService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly sourceFiles: SourceFileRepository,
    private readonly jobs: JobRepository,
    private readonly storage: Storage,
    private readonly enqueuer: IngestEnqueuer,
  ) {}

  async initiateUpload(
    projectId: string,
    ownerUserId: string,
    input: InitiateUploadInput,
  ): Promise<{ fileId: string; uploadUrl: string; s3Key: string }> {
    const project = await this.projects.findByIdForOwner(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');

    const validation = validateUpload(input);
    if (!validation.ok) {
      throw validation.reason === 'too_large' ? Errors.fileTooLarge() : Errors.unsupportedFormat();
    }

    const s3Key = `uploads/${projectId}/${randomUUID()}/${sanitizeFilename(input.filename)}`;
    const contentType = input.contentType ?? CONTENT_TYPE_BY_MIME[validation.mime];
    const { url } = await this.storage.presignPut(s3Key, contentType);

    const created = await this.sourceFiles.create({
      projectId,
      s3Key,
      mime: validation.mime,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
    });

    return { fileId: created.id, uploadUrl: url, s3Key };
  }

  async startIngest(sourceFileId: string, ownerUserId: string): Promise<{ jobId: string }> {
    const sourceFile = await this.sourceFiles.findByIdWithOwner(sourceFileId);
    if (!sourceFile || sourceFile.ownerUserId !== ownerUserId) throw Errors.notFound('Arquivo');

    const job = await this.jobs.create({
      type: 'ingest',
      projectId: sourceFile.projectId,
      refId: sourceFile.id,
      progress: { current: 'extract', steps: INGEST_STEPS.map((s) => ({ ...s })) },
    });

    await this.enqueuer.enqueueIngest({
      jobId: job.id,
      sourceFileId: sourceFile.id,
      projectId: sourceFile.projectId,
    });

    return { jobId: job.id };
  }
}
