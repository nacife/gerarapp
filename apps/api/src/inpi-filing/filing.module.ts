import { Module } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { getEnv } from '@eduforge/config';
import { AdminModule } from '../admin/admin.module';
import { AuditService } from '../admin/audit.service';
import { IdempotencyInterceptor, IDEMPOTENCY_REDIS } from '../common/idempotency.interceptor';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WebhooksService } from '../webhooks/webhooks.service';
import { FilingController } from './filing.controller';
import { OperatorFilingController } from './operator.controller';
import { FilingService } from './filing.service';
import { OperatorService } from './operator.service';
import { MockSignatureValidator } from './signature-validator';
import {
  PrismaFilingCertificateRepository,
  PrismaFilingEventRepository,
  PrismaFilingRepository,
} from './adapters/prisma.repositories';
import { S3FilingStorage } from './adapters/s3.storage';

const FILING_REDIS = Symbol('FILING_REDIS');

@Module({
  imports: [AdminModule, WebhooksModule],
  controllers: [FilingController, OperatorFilingController],
  providers: [
    {
      provide: FILING_REDIS,
      useFactory: (): Redis => new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null }),
    },
    { provide: IDEMPOTENCY_REDIS, useExisting: FILING_REDIS },
    IdempotencyInterceptor,
    {
      provide: FilingService,
      inject: [WebhooksService],
      useFactory: (webhooks: WebhooksService) => {
        const env = getEnv();
        return new FilingService(
          new PrismaFilingRepository(),
          new PrismaFilingEventRepository(),
          new PrismaFilingCertificateRepository(),
          new S3FilingStorage(),
          new MockSignatureValidator(),
          { serviceFeeCents: env.INPI_SERVICE_FEE_CENTS, gruFeeCents: env.INPI_GRU_FEE_CENTS },
          webhooks,
        );
      },
    },
    {
      provide: OperatorService,
      inject: [AuditService, WebhooksService],
      useFactory: (audit: AuditService, webhooks: WebhooksService) =>
        new OperatorService(
          new PrismaFilingRepository(),
          new PrismaFilingEventRepository(),
          new S3FilingStorage(),
          audit,
          webhooks,
        ),
    },
  ],
})
export class FilingModule {}
