import { Module } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { getEnv } from '@eduforge/config';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { BullMqWebhookEnqueuer } from './adapters/enqueuer';
import {
  PrismaWebhookDeliveryRepository,
  PrismaWebhookEndpointRepository,
  PrismaWebhookProjectRepository,
} from './adapters/prisma.repositories';

const WEBHOOKS_REDIS = Symbol('WEBHOOKS_REDIS');

@Module({
  controllers: [WebhooksController],
  providers: [
    {
      provide: WEBHOOKS_REDIS,
      useFactory: (): Redis => new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null }),
    },
    {
      provide: WebhooksService,
      inject: [WEBHOOKS_REDIS],
      useFactory: (redis: Redis) =>
        new WebhooksService(
          new PrismaWebhookEndpointRepository(),
          new PrismaWebhookDeliveryRepository(),
          new PrismaWebhookProjectRepository(),
          new BullMqWebhookEnqueuer(redis),
          getEnv().AUTH_ENCRYPTION_KEY,
        ),
    },
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
