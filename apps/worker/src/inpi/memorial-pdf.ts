import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { MemorialOutput } from '@eduforge/ai';

const MARGIN = 56;
const PAGE_SIZE: [number, number] = [595, 842]; // A4 retrato
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

export interface MemorialPdfInput {
  title: string;
  slug: string;
  versionNumber: number;
  memorial: MemorialOutput;
  /** Data fixa (do AppVersion) — mantém o PDF byte-reprodutível (não usar `new Date()`). */
  fixedDate: Date;
}

/** Memorial descritivo em PDF (RF-16.1, `03-memorial-descritivo/memorial.pdf`). */
export async function buildMemorialPdf(input: MemorialPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setCreationDate(input.fixedDate);
  doc.setModificationDate(input.fixedDate);
  doc.setTitle(`Memorial Descritivo — ${input.title}`);
  doc.setProducer('EduForge');

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const brand = rgb(0.06, 0.4, 0.6);
  const maxWidth = PAGE_SIZE[0] - MARGIN * 2;

  let page = doc.addPage(PAGE_SIZE);
  let y = PAGE_SIZE[1] - MARGIN;

  function ensureSpace(next: number) {
    if (y - next < MARGIN) {
      page = doc.addPage(PAGE_SIZE);
      y = PAGE_SIZE[1] - MARGIN;
    }
  }

  function heading(text: string) {
    ensureSpace(28);
    page.drawText(text, { x: MARGIN, y, size: 14, font: bold, color: brand });
    y -= 24;
  }

  function paragraph(text: string) {
    for (const line of wrapText(text, regular, BODY_SIZE, maxWidth)) {
      ensureSpace(LINE_HEIGHT);
      page.drawText(line, { x: MARGIN, y, size: BODY_SIZE, font: regular });
      y -= LINE_HEIGHT;
    }
    y -= 8;
  }

  function field(label: string, value: string) {
    ensureSpace(LINE_HEIGHT);
    page.drawText(label, { x: MARGIN, y, size: BODY_SIZE, font: bold });
    page.drawText(value, { x: MARGIN + 150, y, size: BODY_SIZE, font: regular });
    y -= LINE_HEIGHT + 4;
  }

  page.drawText('Memorial Descritivo', { x: MARGIN, y, size: 22, font: bold, color: brand });
  y -= 20;
  page.drawText(`${input.title} — versão ${input.versionNumber} (${input.slug})`, {
    x: MARGIN,
    y,
    size: 12,
    font: regular,
  });
  y -= 36;

  heading('1. Descrição Funcional');
  paragraph(input.memorial.functionalDescription);

  heading('2. Arquitetura');
  paragraph(input.memorial.architectureDescription);

  heading('3. Dados para o Formulário e-Software');
  field('Campo de aplicação:', input.memorial.applicationField);
  field('Tipo de programa:', input.memorial.programType);

  return Buffer.from(await doc.save());
}
