import { Module } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { getEnv } from '@eduforge/config';
import { LearningModule } from '../learning/learning.module';
import { SenseiController, SenseiPublicController } from './sensei.controller';
import { SenseiService } from './sensei.service';
import { createAiProvider } from '@eduforge/ai';
import {
  PrismaSenseiProjectRepository,
  PrismaSenseiRetrievalRepository,
  PrismaSenseiCreditsRepository,
  PrismaSenseiEventRepository,
} from './adapters/prisma.repositories';

const SENSEI_REDIS = Symbol('SENSEI_REDIS');

@Module({
  imports: [LearningModule],
  controllers: [SenseiController, SenseiPublicController],
  providers: [
    {
      provide: SENSEI_REDIS,
      useFactory: (): Redis => new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null }),
    },
    {
      provide: SenseiService,
      inject: [SENSEI_REDIS],
      useFactory: () =>
        new SenseiService(
          new PrismaSenseiProjectRepository(),
          new PrismaSenseiRetrievalRepository(),
          new PrismaSenseiCreditsRepository(),
          new PrismaSenseiEventRepository(),
          createAiProvider({
            provider: getEnv().AI_PROVIDER as 'mock' | 'anthropic',
            apiKey: getEnv().ANTHROPIC_API_KEY,
          }),
        ),
    },
  ],
  exports: [SenseiService],
})
export class SenseiModule {}
