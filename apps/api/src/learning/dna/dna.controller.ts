import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser, RequireScope, type AuthenticatedUser } from '../../common/decorators';
import { CurrentLearner, LearnerAuthGuard } from '../learner-auth.guard';
import type { AuthenticatedLearner } from '../learner-auth.guard';
import { LearningDnaService } from './learning-dna.service';

@Controller()
export class DnaController {
  constructor(private readonly dna: LearningDnaService) {}

  /** DNA do aprendiz (visualização radial) */
  @Get('public/enrollments/:id/dna')
  @UseGuards(LearnerAuthGuard)
  async getLearnerDna(@CurrentLearner() learner: AuthenticatedLearner, @Param('id') id: string) {
    return this.dna.computeProfile(id, learner.id);
  }

  /** Agregado anônimo para o criador */
  @Get('projects/:id/dna')
  @RequireScope('analytics:read')
  async getCreatorAggregate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.dna.getCreatorAggregate(id);
  }
}
