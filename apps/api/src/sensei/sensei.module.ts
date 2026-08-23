import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { SenseiController, SenseiPublicController } from './sensei.controller';
import { SenseiService } from './sensei.service';
import { createAppAiProvider } from '../common/ai.factory';
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
          createAppAiProvider(),
        ),
    },
  ],
  exports: [SenseiService],
})
export class SenseiModule {}
