import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const MARGIN = 56;
const PAGE_SIZE: [number, number] = [595, 842];
const BODY_SIZE = 11;
const LINE_HEIGHT = 15;

function wrapText(text: string, font: { widthOfTextAtSize(t: string, s: number): number }, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface DeclarationPdfInput {
  title: string;
  slug: string;
  versionNumber: number;
  holderName: string;
  algorithm: string;
  bundleHashSha512: string;
  bundleHashSha256: string;
  generatedAt: Date;
  /** Data fixa (do AppVersion) — mantém o PDF byte-reprodutível (não usar `new Date()`). */
  fixedDate: Date;
}

/** Declaração de Integridade em PDF (RF-16.2/16.3) — hash + instruções de verificação. */
export async function buildDeclarationPdf(input: DeclarationPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setCreationDate(input.fixedDate);
  doc.setModificationDate(input.fixedDate);
  doc.setTitle(`Declaração de Integridade — ${input.title}`);
  doc.setProducer('EduForge');

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const brand = rgb(0.06, 0.4, 0.6);
  const muted = rgb(0.45, 0.45, 0.45);
  const maxWidth = PAGE_SIZE[0] - MARGIN * 2;

  const page = doc.addPage(PAGE_SIZE);
  let y = PAGE_SIZE[1] - MARGIN;

  function field(label: string, value: string) {
    page.drawText(label, { x: MARGIN, y, size: BODY_SIZE, font: bold });
    y -= LINE_HEIGHT;
    for (const line of wrapText(value, mono, 9, maxWidth)) {
      page.drawText(line, { x: MARGIN, y, size: 9, font: mono });
      y -= 12;
    }
    y -= 10;
  }

  function paragraph(text: string, font = regular, size = BODY_SIZE) {
    for (const line of wrapText(text, font, size, maxWidth)) {
      page.drawText(line, { x: MARGIN, y, size, font });
      y -= LINE_HEIGHT;
    }
    y -= 8;
  }

  page.drawText('Declaração de Integridade', { x: MARGIN, y, size: 20, font: bold, color: brand });
  y -= 20;
  page.drawText(`${input.title} — versão ${input.versionNumber} (${input.slug})`, {
    x: MARGIN,
    y,
    size: 12,
    font: regular,
  });
  y -= 32;

  paragraph(
    `Este documento certifica que a EduForge Tecnologia Educacional Ltda. gerou, em ` +
      `${input.generatedAt.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}, o pacote canônico ` +
      `de código-fonte e documentação técnica do aplicativo "${input.title}" (versão ` +
      `${input.versionNumber}), a pedido do titular ${input.holderName}, e calculou os resumos ` +
      `hash abaixo sobre o arquivo ZIP resultante.`,
  );

  field(`Algoritmo principal (${input.algorithm}):`, input.bundleHashSha512);
  field('Algoritmo adicional (SHA-256):', input.bundleHashSha256);

  paragraph('Verificação independente:', bold, BODY_SIZE);
  paragraph(`sha512sum pacote-inpi-${input.slug}-v${input.versionNumber}.zip`, mono, 10);

  y -= 10;
  paragraph(
    'O INPI recebe apenas o resumo hash, não o arquivo. A guarda do ZIP original é ' +
      'responsabilidade do titular, em ambiente seguro, pelo prazo de vigência do registro ' +
      '(até 50 anos) — o hash só vale como prova de integridade se o titular conseguir ' +
      'reapresentar exatamente os mesmos bytes no futuro. A EduForge mantém uma cópia em ' +
      'armazenamento imutável como redundância, não como substituição da guarda do titular.',
    regular,
    9,
  );
  y -= 4;
  page.drawText(
    'Este documento não constitui parecer jurídico nem garantia de concessão do registro pelo INPI.',
    { x: MARGIN, y, size: 8, font: regular, color: muted },
  );

  return Buffer.from(await doc.save());
}
