import { beforeEach, describe, expect, it } from 'vitest';
import type { ContentMapTree } from '@eduforge/schemas';
import { AppError } from '../common/errors';
import { ContentMapService } from './content-map.service';
import { ProjectsService } from './projects.service';
import { SourceFilesService } from './source-files.service';
import {
  FakeIngestEnqueuer,
  FakeStorage,
  InMemoryContentMapRepository,
  InMemoryJobRepository,
  InMemoryProjectRepository,
  InMemorySourceFileRepository,
} from './testing/fakes';

const OWNER = 'owner-1';

async function expectError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('esperava AppError');
}

describe('SourceFilesService — upload e ingestão (US-ING-01)', () => {
  let projects: InMemoryProjectRepository;
  let sourceFiles: InMemorySourceFileRepository;
  let jobs: InMemoryJobRepository;
  let storage: FakeStorage;
  let enqueuer: FakeIngestEnqueuer;
  let service: SourceFilesService;
  let projectId: string;

  beforeEach(() => {
    projects = new InMemoryProjectRepository();
    sourceFiles = new InMemorySourceFileRepository(projects);
    jobs = new InMemoryJobRepository();
    storage = new FakeStorage();
    enqueuer = new FakeIngestEnqueuer();
    service = new SourceFilesService(projects, sourceFiles, jobs, storage, enqueuer);
    projectId = projects.seedProject(OWNER).id;
  });

  const validInput = {
    filename: 'biologia.pdf',
    contentType: 'application/pdf',
    sizeBytes: 42 * 1024 * 1024,
    sha256: 'a'.repeat(64),
  };

  it('inicia upload válido: cria source_file e devolve URL pré-assinada', async () => {
    const res = await service.initiateUpload(projectId, OWNER, validInput);
    expect(res.uploadUrl).toContain('signature=fake');
    expect(sourceFiles.files).toHaveLength(1);
    expect(sourceFiles.files[0]!.sha256).toBe(validInput.sha256);
  });

  it('arquivo acima do limite: erro e NENHUM job/source_file criado', async () => {
    const err = await expectError(() =>
      service.initiateUpload(projectId, OWNER, { ...validInput, sizeBytes: 250 * 1024 * 1024 }),
    );
    expect(err.slug).toBe('file-too-large');
    expect(sourceFiles.files).toHaveLength(0);
    expect(jobs.jobs).toHaveLength(0);
  });

  it('formato não suportado é rejeitado', async () => {
    const err = await expectError(() =>
      service.initiateUpload(projectId, OWNER, {
        ...validInput,
        filename: 'apresentacao.pages',
        contentType: 'application/x-iwork-pages-sffpages',
      }),
    );
    expect(err.slug).toBe('unsupported-format');
  });

  it('não permite upload em projeto de outro dono (multi-tenant)', async () => {
    const err = await expectError(() => service.initiateUpload(projectId, 'intruso', validInput));
    expect(err.slug).toBe('not-found');
  });

  it('startIngest cria job com etapas e enfileira', async () => {
    const { fileId } = await service.initiateUpload(projectId, OWNER, validInput);
    const { jobId } = await service.startIngest(fileId, OWNER);
    expect(enqueuer.enqueued).toHaveLength(1);
    const job = jobs.jobs.find((j) => j.id === jobId)!;
    expect(job.progress?.steps.map((s) => s.label)).toEqual([
      'Extraindo',
      'Estruturando',
      'Classificando',
    ]);
  });
});

describe('ContentMapService — revisão e aprovação (US-ING-02)', () => {
  let projects: InMemoryProjectRepository;
  let maps: InMemoryContentMapRepository;
  let service: ContentMapService;
  let projectId: string;

  const tree: ContentMapTree = {
    chapters: [
      {
        id: 'c1',
        title: 'Divisão Celular',
        confidence: 0.9,
        children: [
          { id: 's1', title: 'Mitose', confidence: 0.6, kind: 'concept' },
          { id: 's2', title: 'Meiose', confidence: 0.85, kind: 'concept' },
        ],
      },
    ],
  };

  beforeEach(() => {
    projects = new InMemoryProjectRepository();
    maps = new InMemoryContentMapRepository();
    service = new ContentMapService(projects, maps);
    projectId = projects.seedProject(OWNER).id;
  });

  it('salvar árvore editada cria nova revisão', async () => {
    const r1 = await service.update(projectId, OWNER, tree);
    expect(r1.revision).toBe(1);
    const r2 = await service.update(projectId, OWNER, tree);
    expect(r2.revision).toBe(2);
    expect(r2.structureConfidence).toBeGreaterThan(0);
  });

  it('aprovar preenche approved_at', async () => {
    await service.update(projectId, OWNER, tree);
    const approved = await service.approve(projectId, OWNER);
    expect(approved.approvedAt).toBeInstanceOf(Date);
  });

  it('bloqueia acesso de outro dono', async () => {
    await service.update(projectId, OWNER, tree);
    const err = await expectError(() => service.get(projectId, 'intruso'));
    expect(err.slug).toBe('not-found');
  });
});

describe('ProjectsService — criação e slug', () => {
  it('cria projeto com slug único a partir do título', async () => {
    const projects = new InMemoryProjectRepository();
    const service = new ProjectsService(projects);
    const p1 = await service.create(OWNER, 'Biologia Viva');
    const p2 = await service.create(OWNER, 'Biologia Viva');
    expect(p1.slug).toMatch(/^biologia-viva-/);
    expect(p1.slug).not.toBe(p2.slug);
  });
});
