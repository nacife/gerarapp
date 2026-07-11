import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser, Public, RequireScope, type AuthenticatedUser } from '../../common/decorators';
import { CurrentLearner, LearnerAuthGuard } from '../learner-auth.guard';
import type { AuthenticatedLearner } from '../learner-auth.guard';
import { LearningDnaService } from './learning-dna.service';

@Public()
@Controller()
export class DnaPublicController {
  constructor(private readonly dna: LearningDnaService) {}

  @Get('public/enrollments/:id/dna')
  @UseGuards(LearnerAuthGuard)
  async getLearnerDna(@CurrentLearner() learner: AuthenticatedLearner, @Param('id') id: string) {
    return this.dna.computeProfile(id, learner.id);
  }
}

@Controller()
export class DnaCreatorController {
  constructor(private readonly dna: LearningDnaService) {}

  @Get('projects/:id/dna')
  @RequireScope('analytics:read')
  async getCreatorAggregate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.dna.getCreatorAggregate(id);
  }
}
