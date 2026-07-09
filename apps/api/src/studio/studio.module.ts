import { Module } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { getEnv } from '@eduforge/config';
import { IdempotencyInterceptor, IDEMPOTENCY_REDIS } from '../common/idempotency.interceptor';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  CatalogController,
  PublicAppController,
  StudioController,
} from './studio.controller';
import { StudioService } from './studio.service';
import { CatalogService } from './catalog.service';
import { PublicAppService } from './public-app.service';
import {
  PrismaCatalogRepository,
  PrismaStudioRepository,
  S3ManifestStorage,
} from './adapters/prisma.repositories';
import { BullMqSenseiEmbedEnqueuer } from './adapters/sensei-enqueuer';
import { Argon2idHasher } from '../auth/domain/password-hasher';

const STUDIO_REDIS = Symbol('STUDIO_REDIS');

@Module({
  imports: [WebhooksModule],
  controllers: [CatalogController, StudioController, PublicAppController],
  providers: [
    {
      provide: STUDIO_REDIS,
      useFactory: (): Redis => new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null }),
    },
    { provide: IDEMPOTENCY_REDIS, useExisting: STUDIO_REDIS },
    IdempotencyInterceptor,
    {
      provide: StudioService,
      inject: [WebhooksService, STUDIO_REDIS],
      useFactory: (webhooks: WebhooksService, redis: Redis) =>
        new StudioService(
          new PrismaStudioRepository(),
          new S3ManifestStorage(),
          new Argon2idHasher(),
          getEnv().RUNTIME_BASE_URL,
          webhooks,
          new BullMqSenseiEmbedEnqueuer(redis),
        ),
    },
    {
      provide: CatalogService,
      useFactory: () => new CatalogService(new PrismaCatalogRepository()),
    },
    {
      provide: PublicAppService,
      useFactory: () => new PublicAppService(new PrismaStudioRepository(), new Argon2idHasher()),
    },
  ],
})
export class StudioModule {}
