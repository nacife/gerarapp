import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EnrollmentService } from './enrollment.service';
import { EventsService } from './events.service';
import { LearnerAuthService } from './learner-auth.service';
import { AuthenticatedLearner, CurrentLearner, LearnerAuthGuard } from './learner-auth.guard';
import {
  enrollSchema,
  recordEventSchema,
  type EnrollDto,
  type RecordEventDto,
} from './dto/schemas';

@Public()
@UseGuards(LearnerAuthGuard)
@Controller('public')
export class EnrollmentController {
  constructor(
    private readonly enrollments: EnrollmentService,
    private readonly events: EventsService,
    private readonly learnerAuth: LearnerAuthService,
  ) {}

  @Post('apps/:slug/enroll')
  @HttpCode(201)
  async enroll(
    @CurrentLearner() learner: AuthenticatedLearner,
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(enrollSchema)) dto: EnrollDto,
  ) {
    const me = await this.learnerAuth.me(learner.id);
    return this.enrollments.enroll({
      slug,
      learnerId: learner.id,
      learnerEmail: me.email,
      accessKey: dto.accessKey,
    });
  }

  @Get('enrollments/:id/progress')
  progress(@CurrentLearner() learner: AuthenticatedLearner, @Param('id') id: string) {
    return this.enrollments.getProgress(id, learner.id);
  }

  @Post('enrollments/:id/events')
  @HttpCode(200)
  recordEvent(
    @CurrentLearner() learner: AuthenticatedLearner,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(recordEventSchema)) dto: RecordEventDto,
  ) {
    return this.events.record(id, learner.id, dto);
  }

  /** Conquistas do aprendiz (RF-06.7) — computadas do estado existente. */
  @Get('enrollments/:id/achievements')
  achievements(@CurrentLearner() learner: AuthenticatedLearner, @Param('id') id: string) {
    return this.enrollments.getAchievements(id, learner.id);
  }
}

/** Rotas públicas do runtime (sem autenticação). */
@Public()
@Controller('public')
export class LeaderboardController {
  constructor(private readonly enrollments: EnrollmentService) {}

  /** Ranking do app publicado (top 10 XP). */
  @Get('apps/:slug/leaderboard')
  leaderboard(@Param('slug') slug: string) {
    return this.enrollments.getLeaderboard(slug);
  }
}
