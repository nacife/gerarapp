import { createHash } from 'node:crypto';
import type { AiProvider } from '@eduforge/ai';
import type { ContentMapTree } from '@eduforge/schemas';
import { buildContentMap, type BuiltBlock } from './build-map';
import type { DocumentExtractor } from './extractor';
import type { OcrProvider } from './ocr';

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

export interface IngestSourceFile {
  id: string;
  projectId: string;
  s3Key: string;
  mime: string;
}

export interface IngestStorage {
  download(s3Key: string): Promise<Buffer>;
}

export interface IngestRepository {
  getSourceFile(id: string): Promise<IngestSourceFile | null>;
  saveJob(
    jobId: string,
    patch: {
      status?: 'running' | 'succeeded' | 'failed';
      progress?: JobProgress;
      error?: string;
    },
  ): Promise<void>;
  updateSourceFile(
    id: string,
    patch: { ocrStatus?: string; sha256?: string; extractionReport?: unknown },
  ): Promise<void>;
  saveContentMap(input: {
    projectId: string;
    tree: ContentMapTree;
    structureConfidence: number;
    blocks: BuiltBlock[];
  }): Promise<{ contentMapId: string }>;
}

export interface IngestPorts {
  storage: IngestStorage;
  extractor: DocumentExtractor;
  ocr: OcrProvider;
  ai: AiProvider;
  repo: IngestRepository;
}

export interface IngestJobData {
  jobId: string;
  sourceFileId: string;
  projectId: string;
}

function initialProgress(): JobProgress {
  return {
    current: 'extract',
    steps: [
      { key: 'extract', label: 'Extraindo', status: 'pending', pct: 0 },
      { key: 'structure', label: 'Estruturando', status: 'pending', pct: 0 },
      { key: 'classify', label: 'Classificando', status: 'pending', pct: 0 },
    ],
  };
}

function setStep(p: JobProgress, key: string, status: JobStep['status'], pct: number): void {
  p.current = key;
  const step = p.steps.find((s) => s.key === key);
  if (step) {
    step.status = status;
    step.pct = pct;
  }
}

/**
 * Pipeline de ingestão (RF-01): extração → estruturação (IA) → classificação,
 * com progresso persistido a cada etapa. Puro: recebe todas as dependências.
 */
export async function runIngestion(
  data: IngestJobData,
  ports: IngestPorts,
): Promise<{ contentMapId: string }> {
  const { storage, extractor, ocr, ai, repo } = ports;

  const sourceFile = await repo.getSourceFile(data.sourceFileId);
  if (!sourceFile) throw new Error(`source file ${data.sourceFileId} não encontrado`);

  const progress = initialProgress();
  await repo.saveJob(data.jobId, { status: 'running', progress });

  // 1 — Extração (com OCR automático se não houver camada de texto)
  setStep(progress, 'extract', 'running', 20);
  await repo.saveJob(data.jobId, { progress });

  const buffer = await storage.download(sourceFile.s3Key);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  let doc = await extractor.extract(buffer, sourceFile.mime);

  let ocrStatus = 'not_needed';
  if (!doc.hasTextLayer) {
    ocrStatus = 'done';
    await repo.updateSourceFile(sourceFile.id, { ocrStatus: 'running' });
    const text = await ocr.recognize(buffer, sourceFile.mime);
    doc = { ...doc, text, hasTextLayer: true };
  }
  await repo.updateSourceFile(sourceFile.id, {
    ocrStatus,
    sha256,
    extractionReport: { pageCount: doc.pageCount, chars: doc.text.length, ocr: ocrStatus },
  });
  setStep(progress, 'extract', 'done', 100);
  await repo.saveJob(data.jobId, { progress });

  // 2 — Estruturação (IA via AiProvider)
  setStep(progress, 'structure', 'running', 20);
  await repo.saveJob(data.jobId, { progress });
  const filename = sourceFile.s3Key.split('/').pop() ?? 'documento';
  const structured = await ai.structureContent({ rawText: doc.text, filename });
  setStep(progress, 'structure', 'done', 100);
  await repo.saveJob(data.jobId, { progress });

  // 3 — Classificação e montagem do Mapa de Conteúdo
  setStep(progress, 'classify', 'running', 20);
  await repo.saveJob(data.jobId, { progress });
  const { tree, blocks, structureConfidence } = buildContentMap(structured, doc.text);
  const { contentMapId } = await repo.saveContentMap({
    projectId: sourceFile.projectId,
    tree,
    structureConfidence,
    blocks,
  });
  setStep(progress, 'classify', 'done', 100);
  await repo.saveJob(data.jobId, { status: 'succeeded', progress });

  return { contentMapId };
}
