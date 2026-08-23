import { Controller, Post, Body, Param, Sse, UseGuards } from '@nestjs/common';
import { BattleService } from './battle.service';
import { Public } from '../common/decorators';
import { LearnerAuthGuard, CurrentLearner, AuthenticatedLearner } from '../learning/learner-auth.guard';
import { Observable } from 'rxjs';

@Controller('public/enrollments/:id/battle')
@Public()
@UseGuards(LearnerAuthGuard)
export class BattleController {
  constructor(private readonly battleService: BattleService) {}

  @Sse('stream')
  stream(@Param('id') id: string): Observable<any> {
    return this.battleService.stream(id);
  }

  @Post('join')
  join(
    @Param('id') id: string,
    @CurrentLearner() learner: AuthenticatedLearner,
    @Body('name') name: string
  ) {
    this.battleService.joinLobby(id, { id: learner.id, name: name || 'Jogador' });
    return { success: true };
  }

  @Post('score')
  score(
    @Param('id') id: string,
    @CurrentLearner() learner: AuthenticatedLearner,
    @Body('delta') delta: number
  ) {
    this.battleService.submitScore(id, learner.id, delta);
    return { success: true };
  }
}
