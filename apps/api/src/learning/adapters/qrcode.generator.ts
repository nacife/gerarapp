import QRCode from 'qrcode';
import type { QrCodeGenerator } from '../ports';

export class QrcodeGenerator implements QrCodeGenerator {
  async toPngBuffer(text: string): Promise<Buffer> {
    return QRCode.toBuffer(text, { type: 'png', width: 320, margin: 1 });
  }
}
