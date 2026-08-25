import { Module } from '@nestjs/common';
import { BattleService } from './battle.service';
import { BattleController } from './battle.controller';
import { LearningModule } from '../learning/learning.module';

@Module({
  imports: [LearningModule],
  controllers: [BattleController],
  providers: [BattleService],
})
export class RealtimeModule {}
