import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { CertificatePdfBuilder } from '../ports';

/** Certificado de conclusão em PDF (paisagem A4) com QR de verificação (RF-05). */
export class PdfLibCertificateBuilder implements CertificatePdfBuilder {
  async build(input: {
    learnerName: string;
    projectTitle: string;
    issuedAt: Date;
    verifyCode: string;
    verifyUrl: string;
    qrPng: Buffer;
  }): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([842, 595]); // A4 paisagem
    const { width, height } = page.getSize();
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const brand = rgb(0.06, 0.4, 0.6);

    page.drawRectangle({
      x: 24,
      y: 24,
      width: width - 48,
      height: height - 48,
      borderColor: brand,
      borderWidth: 3,
    });
    page.drawText('EduForge', { x: 60, y: height - 80, size: 16, font: bold, color: brand });
    page.drawText('Certificado de Conclusão', {
      x: 60,
      y: height - 130,
      size: 30,
      font: bold,
      color: brand,
    });
    page.drawText(input.learnerName, { x: 60, y: height - 210, size: 24, font: bold });
    page.drawText('concluiu com êxito o curso', { x: 60, y: height - 245, size: 13, font: regular });
    page.drawText(input.projectTitle, { x: 60, y: height - 280, size: 20, font: bold });
    page.drawText(
      `Emitido em ${input.issuedAt.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
      { x: 60, y: height - 320, size: 12, font: regular },
    );
    page.drawText(`Código de verificação: ${input.verifyCode}`, { x: 60, y: 70, size: 10, font: regular });
    page.drawText(input.verifyUrl, { x: 60, y: 54, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });

    const qrImage = await doc.embedPng(input.qrPng);
    const qrDim = 130;
    page.drawImage(qrImage, { x: width - qrDim - 70, y: 60, width: qrDim, height: qrDim });

    return Buffer.from(await doc.save());
  }
}
