import { Module } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { getEnv } from '@eduforge/config';
import { createAiProvider } from '@eduforge/ai';
import {
  InteractionsController,
  ProjectInteractionsController,
} from './interactions.controller';
import { CreditsController } from './credits.controller';
import { InteractionsService } from './interactions.service';
import { CreditsService } from './credits.service';
import {
  PrismaContentMapRepository,
  PrismaJobRepository,
  PrismaProjectRepository,
} from '../projects/adapters/prisma.repositories';
import { PrismaCreditRepository, PrismaInteractionRepository } from './adapters/prisma.repositories';
import { BullMqGenerateEnqueuer } from './adapters/enqueuer';

const INTERACTIONS_REDIS = Symbol('INTERACTIONS_REDIS');

@Module({
  controllers: [ProjectInteractionsController, InteractionsController, CreditsController],
  providers: [
    {
      provide: INTERACTIONS_REDIS,
      useFactory: (): Redis => new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null }),
    },
    {
      provide: CreditsService,
      useFactory: () => new CreditsService(new PrismaCreditRepository()),
    },
    {
      provide: InteractionsService,
      inject: [INTERACTIONS_REDIS],
      useFactory: (redis: Redis) => {
        const env = getEnv();
        return new InteractionsService(
          new PrismaProjectRepository(),
          new PrismaContentMapRepository(),
          new PrismaJobRepository(),
          new PrismaInteractionRepository(),
          new PrismaCreditRepository(),
          new BullMqGenerateEnqueuer(redis),
          createAiProvider({
            provider: env.AI_PROVIDER,
            apiKey: env.ANTHROPIC_API_KEY,
            models: { structure: env.AI_MODEL_STRUCTURE, interactions: env.AI_MODEL_INTERACTIONS },
          }),
        );
      },
    },
  ],
})
export class InteractionsModule {}
