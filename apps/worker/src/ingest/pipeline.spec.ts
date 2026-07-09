import { describe, expect, it } from 'vitest';
import { MockAiProvider } from '@eduforge/ai';
import { contentMapTreeSchema } from '@eduforge/schemas';
import type { DocumentExtractor, ExtractedDoc } from './extractor';
import { MockOcrProvider } from './ocr';
import {
  runIngestion,
  type IngestPorts,
  type IngestRepository,
  type IngestSourceFile,
  type IngestStorage,
  type JobProgress,
} from './pipeline';
import type { BuiltBlock } from './build-map';
import type { ContentMapTree } from '@eduforge/schemas';

class FakeStorage implements IngestStorage {
  constructor(private readonly buf: Buffer) {}
  async download(): Promise<Buffer> {
    return this.buf;
  }
}

class FakeExtractor implements DocumentExtractor {
  constructor(private readonly result: ExtractedDoc) {}
  async extract(): Promise<ExtractedDoc> {
    return this.result;
  }
}

class InMemoryIngestRepo implements IngestRepository {
  jobPatches: { status?: string; progress?: JobProgress; error?: string }[] = [];
  sfPatches: { ocrStatus?: string; sha256?: string; extractionReport?: unknown }[] = [];
  savedMap: {
    projectId: string;
    tree: ContentMapTree;
    structureConfidence: number;
    blocks: BuiltBlock[];
  } | null = null;

  constructor(private readonly sf: IngestSourceFile) {}
  async getSourceFile(id: string): Promise<IngestSourceFile | null> {
    return id === this.sf.id ? this.sf : null;
  }
  async saveJob(_id: string, patch: { status?: string; progress?: JobProgress }): Promise<void> {
    this.jobPatches.push(patch);
  }
  async updateSourceFile(
    _id: string,
    patch: { ocrStatus?: string; sha256?: string },
  ): Promise<void> {
    this.sfPatches.push(patch);
  }
  async saveContentMap(input: {
    projectId: string;
    tree: ContentMapTree;
    structureConfidence: number;
    blocks: BuiltBlock[];
  }): Promise<{ contentMapId: string }> {
    this.savedMap = input;
    return { contentMapId: 'map-1' };
  }
}

const SF: IngestSourceFile = {
  id: 'sf1',
  projectId: 'p1',
  s3Key: 'uploads/p1/abc/biologia.pdf',
  mime: 'pdf',
};

function makePorts(extractor: DocumentExtractor, repo: IngestRepository): IngestPorts {
  return {
    storage: new FakeStorage(Buffer.from('%PDF-1.7 conteúdo')),
    extractor,
    ocr: new MockOcrProvider(),
    ai: new MockAiProvider(),
    repo,
  };
}

const jobData = { jobId: 'j1', sourceFileId: 'sf1', projectId: 'p1' };

describe('runIngestion (US-ING-01)', () => {
  it('PDF com texto: gera Mapa válido com capítulos/seções e conclui', async () => {
    const repo = new InMemoryIngestRepo(SF);
    const extractor = new FakeExtractor({
      text: 'A célula é a unidade básica da vida. A membrana delimita a célula. '.repeat(200),
      pageCount: 150,
      hasTextLayer: true,
    });

    const res = await runIngestion(jobData, makePorts(extractor, repo));
    expect(res.contentMapId).toBe('map-1');

    expect(repo.savedMap!.tree.chapters.length).toBeGreaterThanOrEqual(3);
    expect(repo.savedMap!.blocks.length).toBeGreaterThanOrEqual(1);
    expect(repo.savedMap!.structureConfidence).toBeGreaterThan(0);
    // Propriedade: a árvore produzida é válida contra o schema compartilhado.
    expect(() => contentMapTreeSchema.parse(repo.savedMap!.tree)).not.toThrow();

    const last = repo.jobPatches.at(-1)!;
    expect(last.status).toBe('succeeded');
    expect(last.progress!.steps.every((s) => s.status === 'done')).toBe(true);

    const sfFinal = repo.sfPatches.find((p) => p.sha256)!;
    expect(sfFinal.ocrStatus).toBe('not_needed');
    expect(sfFinal.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('PDF escaneado (sem camada de texto) dispara OCR e continua', async () => {
    const repo = new InMemoryIngestRepo(SF);
    const extractor = new FakeExtractor({ text: '', pageCount: 12, hasTextLayer: false });

    await runIngestion(jobData, makePorts(extractor, repo));

    expect(repo.sfPatches.some((p) => p.ocrStatus === 'running')).toBe(true);
    const sfFinal = repo.sfPatches.find((p) => p.sha256)!;
    expect(sfFinal.ocrStatus).toBe('done');
    expect(repo.savedMap!.tree.chapters.length).toBeGreaterThanOrEqual(3);
  });
});
