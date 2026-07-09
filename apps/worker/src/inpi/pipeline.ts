import { createHash } from 'node:crypto';
import type { AiProvider } from '@eduforge/ai';
import { buildMetadata } from '@eduforge/schemas';
import { buildAppFiles } from './domain/app-files';
import { buildInpiPackage } from './domain/package-builder';
import { buildDeclarationPdf } from './declaration-pdf';
import { buildMemorialPdf } from './memorial-pdf';
import { loadRuntimeSnippets } from './runtime-snippets';
import type { PrismaInpiRepository } from './repository';
import type { S3WormStorage } from './s3-worm';
import type { CaptureScreenshotsInput } from './screenshots';

export interface InpiPackageProgress {
  current: string;
  steps: { key: string; label: string; status: 'pending' | 'running' | 'done'; pct: number }[];
  result?: { certificateId: string; bundleHashSha512: string };
}

export interface InpiPackageJobData {
  jobId: string;
  appVersionId: string;
  requestedById: string;
}

export interface InpiPackagePorts {
  ai: AiProvider;
  repo: PrismaInpiRepository;
  storage: S3WormStorage;
  captureScreenshots: (input: CaptureScreenshotsInput) => Promise<{ path: string; content: Buffer }[]>;
  runtimeBaseUrl: string;
  apiBaseUrl: string;
  loadSnippets: typeof loadRuntimeSnippets;
}

const STEP_DEFS = [
  { key: 'memorial', label: 'Gerando memorial descritivo' },
  { key: 'telas', label: 'Capturando telas do app' },
  { key: 'pacote', label: 'Montando pacote e calculando hash' },
  { key: 'upload', label: 'Enviando para armazenamento seguro' },
] as const;

function freshProgress(): InpiPackageProgress {
  return {
    current: STEP_DEFS[0].key,
    steps: STEP_DEFS.map((s) => ({ ...s, status: 'pending' as const, pct: 0 })),
  };
}

function markStep(progress: InpiPackageProgress, key: string, status: 'running' | 'done', pct = status === 'done' ? 100 : 0) {
  const step = progress.steps.find((s) => s.key === key);
  if (step) {
    step.status = status;
    step.pct = pct;
  }
  progress.current = key;
}

/**
 * Gera o Pacote INPI de uma versão publicada (RF-16): memorial descritivo (IA),
 * capturas de tela, pacote canônico determinístico + hash, Declaração de
 * Integridade, tudo congelado no bucket WORM e registrado em `inpi_certificates`.
 */
export async function runInpiPackageGeneration(
  data: InpiPackageJobData,
  ports: InpiPackagePorts,
): Promise<{ certificateId: string; bundleHashSha512: string; projectId: string }> {
  const { repo } = ports;
  const progress = freshProgress();
  await repo.saveJob(data.jobId, { status: 'running', progress });

  const version = await repo.getVersionForPackaging(data.appVersionId);
  if (!version) {
    await repo.saveJob(data.jobId, { status: 'failed', error: 'Versão publicada não encontrada.' });
    throw new Error('versão não encontrada ou não publicada');
  }
  if (await repo.hasCertificate(data.appVersionId)) {
    await repo.saveJob(data.jobId, {
      status: 'failed',
      error: 'Esta versão já possui uma certificação INPI.',
    });
    throw new Error('certificação já existe para esta versão');
  }

  const chapterTitles = version.manifest.content.chapters.map((c) => c.title);
  const interactionTypes = [...new Set(version.manifest.interactions.map((i) => i.type))];

  markStep(progress, 'memorial', 'running');
  await repo.saveJob(data.jobId, { progress });
  const memorial = await ports.ai.generateMemorial({
    title: version.title,
    slug: version.slug,
    versionNumber: version.versionNumber,
    templateKey: version.manifest.theme.template,
    chapterTitles,
    interactionTypes,
  });
  markStep(progress, 'memorial', 'done');
  await repo.saveJob(data.jobId, { progress });

  markStep(progress, 'telas', 'running');
  await repo.saveJob(data.jobId, { progress });
  const screenshots = await ports.captureScreenshots({
    apiBaseUrl: ports.apiBaseUrl,
    runtimeBaseUrl: ports.runtimeBaseUrl,
    slug: version.slug,
  });
  markStep(progress, 'telas', 'done');
  await repo.saveJob(data.jobId, { progress });

  markStep(progress, 'pacote', 'running');
  await repo.saveJob(data.jobId, { progress });

  const memorialPdf = await buildMemorialPdf({
    title: version.title,
    slug: version.slug,
    versionNumber: version.versionNumber,
    memorial,
    fixedDate: version.publishedAt,
  });

  const metadata = buildMetadata({
    title: version.title,
    slug: version.slug,
    versionNumber: version.versionNumber,
    createdAt: version.projectCreatedAt,
    publishedAt: version.publishedAt,
    holderName: version.ownerName,
    authors: [version.ownerName],
    algorithm: 'SHA-512',
  });

  const zip = await buildInpiPackage({
    appFiles: buildAppFiles(version.manifest),
    runtimeFiles: ports.loadSnippets(),
    screenshots,
    memorialPdf,
    assets: [],
    metadata,
  });

  const bundleHashSha512 = createHash('sha512').update(zip).digest('hex');
  const bundleHashSha256 = createHash('sha256').update(zip).digest('hex');
  markStep(progress, 'pacote', 'done');
  await repo.saveJob(data.jobId, { progress });

  markStep(progress, 'upload', 'running');
  await repo.saveJob(data.jobId, { progress });

  const declarationPdf = await buildDeclarationPdf({
    title: version.title,
    slug: version.slug,
    versionNumber: version.versionNumber,
    holderName: version.ownerName,
    algorithm: 'SHA-512',
    bundleHashSha512,
    bundleHashSha256,
    generatedAt: version.publishedAt,
    fixedDate: version.publishedAt,
  });

  const zipKey = `inpi/${version.projectId}/v${version.versionNumber}/pacote-inpi-${version.slug}-v${version.versionNumber}.zip`;
  const declarationKey = `inpi/${version.projectId}/v${version.versionNumber}/declaracao-integridade.pdf`;
  await ports.storage.put(zipKey, zip, 'application/zip');
  await ports.storage.put(declarationKey, declarationPdf, 'application/pdf');

  const { certificateId } = await repo.saveCertificate({
    appVersionId: data.appVersionId,
    requestedById: data.requestedById,
    bundleHashSha512,
    bundleHashSha256,
    manifestCanonicalS3Key: zipKey,
    declarationPdfS3Key: declarationKey,
  });

  markStep(progress, 'upload', 'done');
  progress.result = { certificateId, bundleHashSha512 };
  await repo.saveJob(data.jobId, { status: 'succeeded', progress });

  return { certificateId, bundleHashSha512, projectId: version.projectId };
}
