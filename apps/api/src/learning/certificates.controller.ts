import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators';
import { CertificateService } from './certificate.service';

@Public()
@Controller('public')
export class CertificatesController {
  constructor(private readonly certificates: CertificateService) {}

  /** Verificação pública de autenticidade do certificado (QR). */
  @Get('certificates/:code/verify')
  async verify(@Param('code') code: string) {
    const found = await this.certificates.verify(code);
    return {
      valid: true,
      learnerName: found.learnerName,
      projectTitle: found.projectTitle,
      issuedAt: found.issuedAt,
    };
  }

  /** URL pré-assinada (900s) para download do PDF do certificado. */
  @Get('certificates/:code/pdf')
  async downloadUrl(@Param('code') code: string) {
    return { url: await this.certificates.getDownloadUrl(code) };
  }
}
