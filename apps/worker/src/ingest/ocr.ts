/** OCR atrás de interface (PRD §0.2). RF-01: dispara em PDF sem camada de texto. */
export interface OcrProvider {
  readonly name: string;
  recognize(buffer: Buffer, mime: string): Promise<string>;
}

/**
 * Implementação determinística para dev/testes. O TesseractOcrProvider real
 * (tesseract.js) entra atrás desta mesma interface — TODO(prd:RF-01).
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
