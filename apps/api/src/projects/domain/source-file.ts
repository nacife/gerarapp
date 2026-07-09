/** Limite de 200 MB por arquivo (RF-01). */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export type SourceMimeKey = 'pdf' | 'epub' | 'docx' | 'md';

/** Formatos aceitos (RF-01): PDF, EPUB, DOCX, Markdown. */
export const SUPPORTED_FORMATS_LABEL = 'PDF, EPUB, DOCX, Markdown';

const EXTENSION_MAP: Record<string, SourceMimeKey> = {
  pdf: 'pdf',
  epub: 'epub',
  docx: 'docx',
  md: 'md',
  markdown: 'md',
};

const CONTENT_TYPE_MAP: Record<string, SourceMimeKey> = {
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
};

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

/** Deduz o formato a partir da extensão (primário) ou do content-type. */
export function detectMime(filename: string, contentType?: string): SourceMimeKey | null {
  const byExt = EXTENSION_MAP[extensionOf(filename)];
  if (byExt) return byExt;
  if (contentType) {
    const byType = CONTENT_TYPE_MAP[contentType.split(';')[0]?.trim() ?? ''];
    if (byType) return byType;
  }
  return null;
}

export const CONTENT_TYPE_BY_MIME: Record<SourceMimeKey, string> = {
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  md: 'text/markdown',
};

/** Sanitiza o nome do arquivo para compor a chave S3. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'arquivo';
}

export type UploadValidation =
  | { ok: true; mime: SourceMimeKey }
  | { ok: false; reason: 'too_large' | 'unsupported' };

/** Valida um upload antes de criar a URL pré-assinada (US-ING-01). */
export function validateUpload(input: {
  filename: string;
  contentType?: string;
  sizeBytes: number;
}): UploadValidation {
  if (input.sizeBytes > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too_large' };
  const mime = detectMime(input.filename, input.contentType);
  if (!mime) return { ok: false, reason: 'unsupported' };
  return { ok: true, mime };
}
