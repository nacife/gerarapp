import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

export interface ExtractedDoc {
  text: string;
  pageCount: number;
  /** false → provavelmente escaneado, dispara OCR (RF-01). */
  hasTextLayer: boolean;
}

export interface DocumentExtractor {
  extract(buffer: Buffer, mime: string): Promise<ExtractedDoc>;
}

/** Extrator roteado por mime (PDF/DOCX/MD/EPUB). */
export class MimeDocumentExtractor implements DocumentExtractor {
  async extract(buffer: Buffer, mime: string): Promise<ExtractedDoc> {
    switch (mime) {
      case 'pdf':
        return this.pdf(buffer);
      case 'docx':
        return this.docx(buffer);
      case 'md':
        return this.markdown(buffer);
      case 'epub':
        return this.epub(buffer);
      default:
        throw new Error(`Formato não suportado na extração: ${mime}`);
    }
  }

  private async pdf(buffer: Buffer): Promise<ExtractedDoc> {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const joined = Array.isArray(text) ? text.join('\n\n') : text;
    // Heurística de camada de texto: ~caracteres por página.
    const hasTextLayer = joined.trim().length > Math.max(50, totalPages * 10);
    return { text: joined, pageCount: totalPages, hasTextLayer };
  }

  private async docx(buffer: Buffer): Promise<ExtractedDoc> {
    const { value } = await mammoth.extractRawText({ buffer });
    return { text: value, pageCount: 1, hasTextLayer: value.trim().length > 0 };
  }

  private markdown(buffer: Buffer): ExtractedDoc {
    const text = buffer.toString('utf8');
    return { text, pageCount: 1, hasTextLayer: text.trim().length > 0 };
  }

  private epub(buffer: Buffer): ExtractedDoc {
    // TODO(prd:RF-01): extração EPUB dedicada (epub2). Fallback: remove tags.
    const text = buffer.toString('utf8').replace(/<[^>]+>/g, ' ');
    return { text, pageCount: 1, hasTextLayer: text.trim().length > 50 };
  }
}
