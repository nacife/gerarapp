import { Module } from '@nestjs/common';
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

@Module({
  imports: [LearningModule],
  controllers: [SenseiController, SenseiPublicController],
  providers: [
    {
      provide: SenseiService,
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
