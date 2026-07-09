import { Inject, Module } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { getEnv } from '@eduforge/config';
import { createAiProvider } from '@eduforge/ai';
import { SHARED_REDIS } from '../common/redis.module';
import { MediaController, PublicMediaController } from './media.controller';
import { MediaService } from './media.service';
import { PrismaMediaCreditsRepository, PrismaMediaRepository } from './adapters/prisma.repositories';
import { S3MediaStorage } from './adapters/s3.storage';
import { BullMqTtsEnqueuer } from './adapters/enqueuer';

@Module({
  controllers: [MediaController, PublicMediaController],
  providers: [
    {
      provide: MediaService,
      inject: [SHARED_REDIS],
      useFactory: (redis: Redis) =>
        new MediaService(
          new PrismaMediaRepository(),
          new S3MediaStorage(),
          new PrismaMediaCreditsRepository(),
          new BullMqTtsEnqueuer(redis),
          createAiProvider({
            provider: getEnv().AI_PROVIDER as 'mock' | 'anthropic',
            apiKey: getEnv().ANTHROPIC_API_KEY,
          }),
        ),
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
