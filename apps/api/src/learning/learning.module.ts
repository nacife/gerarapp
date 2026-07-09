import { Module } from '@nestjs/common';
import { LEARNER_AUTH, getEnv } from '@eduforge/config';

import { LearnerAuthController } from './learner-auth.controller';
import { EnrollmentController, LeaderboardController } from './enrollment.controller';
import { CertificatesController } from './certificates.controller';
import { LearnersController } from './learners.controller';

import { LearnerAuthService } from './learner-auth.service';
import { EnrollmentService } from './enrollment.service';
import { EventsService } from './events.service';
import { CertificateService } from './certificate.service';

import { LearnerAuthGuard } from './learner-auth.guard';
import { LEARNER_COOKIE_OPTS, LEARNER_TOKEN_SERVICE, PROJECT_REPOSITORY } from './tokens';
import { JwtLearnerTokenService } from './domain/learner-token';
import { SystemClock } from '../auth/domain/clock';
import { Argon2idHasher } from '../auth/domain/password-hasher';
import { PrismaProjectRepository } from '../projects/adapters/prisma.repositories';

import {
  PrismaCertificateRepository,
  PrismaEnrollmentRepository,
  PrismaEventRepository,
  PrismaLearnerRepository,
  PrismaProgressRepository,
} from './adapters/prisma.repositories';
import { S3CertificateStorage } from './adapters/s3.certificate-storage';
import { QrcodeGenerator } from './adapters/qrcode.generator';
import { PdfLibCertificateBuilder } from './adapters/pdf.builder';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WebhooksService } from '../webhooks/webhooks.service';

@Module({
  imports: [WebhooksModule],
  controllers: [LearnerAuthController, EnrollmentController, LeaderboardController, CertificatesController, LearnersController],
  providers: [
    LearnerAuthGuard,
    {
      provide: LEARNER_TOKEN_SERVICE,
      useFactory: () => new JwtLearnerTokenService(getEnv().JWT_SECRET, LEARNER_AUTH.accessTokenTtlSec),
    },
    {
      provide: LEARNER_COOKIE_OPTS,
      useFactory: () => ({
        secure: getEnv().NODE_ENV === 'production',
        ttlSec: LEARNER_AUTH.accessTokenTtlSec,
      }),
    },
    { provide: PROJECT_REPOSITORY, useFactory: () => new PrismaProjectRepository() },
    {
      provide: LearnerAuthService,
      useFactory: () =>
        new LearnerAuthService(
          new PrismaLearnerRepository(),
          new Argon2idHasher(),
          new JwtLearnerTokenService(getEnv().JWT_SECRET, LEARNER_AUTH.accessTokenTtlSec),
        ),
    },
    {
      provide: EnrollmentService,
      inject: [WebhooksService],
      useFactory: (webhooks: WebhooksService) =>
        new EnrollmentService(
          new PrismaEnrollmentRepository(),
          new PrismaProgressRepository(),
          new PrismaCertificateRepository(),
          new Argon2idHasher(),
          webhooks,
        ),
    },
    {
      provide: CertificateService,
      inject: [WebhooksService],
      useFactory: (webhooks: WebhooksService) =>
        new CertificateService(
          new PrismaEnrollmentRepository(),
          new PrismaProgressRepository(),
          new PrismaCertificateRepository(),
          new S3CertificateStorage(),
          new QrcodeGenerator(),
          new PdfLibCertificateBuilder(),
          getEnv().APP_BASE_URL,
          webhooks,
        ),
    },
    {
      provide: EventsService,
      inject: [CertificateService, WebhooksService],
      useFactory: (certificates: CertificateService, webhooks: WebhooksService) =>
        new EventsService(
          new PrismaEventRepository(),
          new PrismaProgressRepository(),
          new PrismaEnrollmentRepository(),
          certificates,
          new SystemClock(),
          webhooks,
        ),
    },
  ],
  exports: [LearnerAuthGuard, LEARNER_TOKEN_SERVICE],
})
export class LearningModule {}
