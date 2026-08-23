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

  private async epub(buffer: Buffer): Promise<ExtractedDoc> {
    try {
      // EPUB is a ZIP archive; parse it to extract structured text
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);

      // Read container.xml to find the OPF file
      const containerXml = await zip.file('META-INF/container.xml')?.async('text');
      if (!containerXml) {
        return this.epubFallback(buffer);
      }

      // Extract OPF path from container
      const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
      const opfPath = rootfileMatch?.[1];
      if (!opfPath) {
        return this.epubFallback(buffer);
      }

      const opfContent = await zip.file(opfPath)?.async('text');
      if (!opfContent) {
        return this.epubFallback(buffer);
      }

      // Get base directory of OPF for resolving relative paths
      const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

      // Extract manifest items (id → href mapping)
      const manifestItems = new Map<string, string>();
      const itemRegex = /<item\s+[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*media-type="([^"]+)"[^>]*/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(opfContent)) !== null) {
        if (itemMatch[3]?.includes('html') || itemMatch[3]?.includes('xml')) {
          manifestItems.set(itemMatch[1]!, itemMatch[2]!);
        }
      }

      // Extract spine order
      const spineIds: string[] = [];
      const itemrefRegex = /<itemref\s+[^>]*idref="([^"]+)"/g;
      let spineMatch;
      while ((spineMatch = itemrefRegex.exec(opfContent)) !== null) {
        spineIds.push(spineMatch[1]!);
      }

      // Read spine items in order, extract text
      const parts: string[] = [];
      for (const id of spineIds) {
        const href = manifestItems.get(id);
        if (!href) continue;
        const filePath = opfDir + href;
        const html = await zip.file(filePath)?.async('text');
        if (!html) continue;
        // Strip HTML tags, normalize whitespace
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/?(p|div|h[1-6]|li|tr|blockquote)[^>]*>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (text.length > 0) parts.push(text);
      }

      const fullText = parts.join('\n\n');
      return {
        text: fullText,
        pageCount: parts.length || 1,
        hasTextLayer: fullText.trim().length > 50,
      };
    } catch {
      return this.epubFallback(buffer);
    }
  }

  /** Fallback básico: remove tags do EPUB se o parser estruturado falhar. */
  private epubFallback(buffer: Buffer): ExtractedDoc {
    const text = buffer.toString('utf8').replace(/<[^>]+>/g, ' ');
    return { text, pageCount: 1, hasTextLayer: text.trim().length > 50 };
  }
}
