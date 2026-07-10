import { Module } from '@nestjs/common';
import { QuizBattleGateway } from './quiz-battle.gateway';

@Module({
  providers: [QuizBattleGateway],
  exports: [QuizBattleGateway],
})
export class RealtimeModule {}
