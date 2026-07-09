import { Body, Controller, Get, HttpCode, Param, Post, UseInterceptors } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InpiService } from './inpi.service';
import { generatePackageSchema, type GeneratePackageDto } from './dto/schemas';

/** Pacote INPI por projeto (RF-16 — autosserviço). */
@Controller('projects')
export class InpiPackageController {
  constructor(private readonly inpi: InpiService) {}

  @Post(':id/inpi/package')
  @HttpCode(202)
  @UseInterceptors(IdempotencyInterceptor)
  generatePackage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(generatePackageSchema)) dto: GeneratePackageDto,
  ) {
    return this.inpi.generatePackage(id, user.id, dto.versionNumber);
  }

  @Get(':id/inpi/certificates')
  listCertificates(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.inpi.listForProject(id, user.id);
  }
}

/** Certificados INPI individuais — hash, downloads e verificação (RF-16.2/16.4). */
@Controller('inpi/certificates')
export class InpiCertificatesController {
  constructor(private readonly inpi: InpiService) {}

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.inpi.getCertificate(id, user.id);
  }

  @Post(':id/verify')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  verify(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.inpi.verify(id, user.id, user.id);
  }
}
