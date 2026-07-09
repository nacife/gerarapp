import archiver from 'archiver';
import { createHash } from 'node:crypto';
import type { InpiMetadata } from '@eduforge/schemas';

/** Timestamp fixo (PRD Parte 5/M7): elimina a única fonte de não-determinismo
 *  que o `archiver` grava por entrada além do conteúdo — a data de modificação. */
const FIXED_ZIP_DATE = new Date('1980-01-01T00:00:00Z');
/** Permissão fixa (rw-r--r--) — evita variação de bits Unix entre SO/ambiente. */
const FIXED_MODE = 0o644;

export interface PackageFile {
  /** Caminho completo dentro do ZIP, ex.: "01-codigo-fonte/app/manifest.json". */
  path: string;
  content: Buffer;
}

export interface BuildInpiPackageInput {
  appFiles: PackageFile[]; // 01-codigo-fonte/app/**
  runtimeFiles: PackageFile[]; // 01-codigo-fonte/runtime/**
  screenshots: PackageFile[]; // 02-telas/**
  memorialPdf: Buffer; // 03-memorial-descritivo/memorial.pdf
  assets: PackageFile[]; // 04-ativos/**
  metadata: InpiMetadata;
}

/** SHA-256 de cada arquivo do pacote, na mesma ordem lexicográfica do ZIP (RF-16.1). */
export function buildManifestFiles(files: PackageFile[]): string {
  const lines = files
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `${createHash('sha256').update(f.content).digest('hex')}  ${f.path}`);
  return lines.join('\n') + '\n';
}

function collectFiles(input: BuildInpiPackageInput): PackageFile[] {
  const metadataJson = Buffer.from(JSON.stringify(sortDeep(input.metadata), null, 2), 'utf-8');
  const files: PackageFile[] = [
    ...input.appFiles.map((f) => ({ ...f, path: `01-codigo-fonte/app/${f.path}` })),
    ...input.runtimeFiles.map((f) => ({ ...f, path: `01-codigo-fonte/runtime/${f.path}` })),
    ...input.screenshots.map((f) => ({ ...f, path: `02-telas/${f.path}` })),
    { path: '03-memorial-descritivo/memorial.pdf', content: input.memorialPdf },
    ...input.assets.map((f) => ({ ...f, path: `04-ativos/${f.path}` })),
    { path: 'METADATA.json', content: metadataJson },
  ];
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Monta o pacote canônico do INPI (ZIP determinístico — RF-16.1). Mesma entrada
 * sempre produz os mesmos bytes: ordenação lexicográfica fixa, timestamp e modo
 * de arquivo fixos por entrada, sem campos voláteis.
 */
export function buildInpiPackage(input: BuildInpiPackageInput): Promise<Buffer> {
  const dataFiles = collectFiles(input);
  const manifestFiles: PackageFile = {
    path: 'MANIFEST-FILES.txt',
    content: Buffer.from(buildManifestFiles(dataFiles), 'utf-8'),
  };
  const allFiles = [...dataFiles, manifestFiles].sort((a, b) => a.path.localeCompare(b.path));

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('warning', (err) => {
      if (err.code !== 'ENOENT') reject(err);
    });
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));

    for (const file of allFiles) {
      archive.append(file.content, { name: file.path, date: FIXED_ZIP_DATE, mode: FIXED_MODE });
    }
    void archive.finalize();
  });
}
