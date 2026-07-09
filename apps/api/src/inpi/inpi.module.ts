import { Module } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { getEnv } from '@eduforge/config';
import { IdempotencyInterceptor, IDEMPOTENCY_REDIS } from '../common/idempotency.interceptor';
import { InpiPackageController, InpiCertificatesController } from './inpi.controller';
import { InpiService } from './inpi.service';
import {
  PrismaInpiCertificateRepository,
  PrismaInpiJobRepository,
  PrismaInpiProjectRepository,
} from './adapters/prisma.repositories';
import { S3InpiStorage } from './adapters/s3.storage';
import { BullMqInpiEnqueuer } from './adapters/enqueuer';

const INPI_REDIS = Symbol('INPI_REDIS');

@Module({
  controllers: [InpiPackageController, InpiCertificatesController],
  providers: [
    {
      provide: INPI_REDIS,
      useFactory: (): Redis => new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null }),
    },
    { provide: IDEMPOTENCY_REDIS, useExisting: INPI_REDIS },
    IdempotencyInterceptor,
    {
      provide: InpiService,
      inject: [INPI_REDIS],
      useFactory: (redis: Redis) =>
        new InpiService(
          new PrismaInpiProjectRepository(),
          new PrismaInpiCertificateRepository(),
          new PrismaInpiJobRepository(),
          new BullMqInpiEnqueuer(redis),
          new S3InpiStorage(),
        ),
    },
  ],
})
export class InpiModule {}
