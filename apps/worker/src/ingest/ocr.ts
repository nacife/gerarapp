/** OCR atrás de interface (PRD §0.2). RF-01: dispara em PDF sem camada de texto. */
export interface OcrProvider {
  readonly name: string;
  recognize(buffer: Buffer, mime: string): Promise<string>;
}

/**
 * Implementação determinística para dev/testes.
 */
export class MockOcrProvider implements OcrProvider {
  readonly name = 'mock';
  async recognize(): Promise<string> {
    return [
      'Capítulo 1 — Conteúdo reconhecido por OCR (mock).',
      'Este texto substitui a camada de texto ausente do documento escaneado.',
      'Capítulo 2 — Segunda seção reconhecida.',
    ].join('\n\n');
  }
}

/**
 * OCR real via tesseract.js — funciona com PDFs escaneados renderizados como
 * imagens. Espera receber o buffer do PDF já convertido em imagem (PNG/JPEG)
 * ou um buffer de imagem direto. Para PDFs multi-página, o caller deve
 * converter cada página em imagem antes de chamar recognize().
 */
export class TesseractOcrProvider implements OcrProvider {
  readonly name = 'tesseract';

  async recognize(buffer: Buffer, _mime: string): Promise<string> {
    // Importa dinamicamente para evitar carga pesada no boot
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('por+eng');
    try {
      const { data } = await worker.recognize(buffer);
      return data.text;
    } finally {
      await worker.terminate();
    }
  }
}

/** Factory baseada no nome do provider (env OCR_PROVIDER). */
export function createOcrProvider(name: string): OcrProvider {
  switch (name) {
    case 'tesseract':
      return new TesseractOcrProvider();
    case 'mock':
    default:
      return new MockOcrProvider();
  }
}
