import { Body, Controller, Get, HttpCode, Inject, Post, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../common/decorators';
import { RateLimit } from '../common/rate-limit.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LearnerAuthService } from './learner-auth.service';
import { AuthenticatedLearner, CurrentLearner, LearnerAuthGuard } from './learner-auth.guard';
import { clearLearnerCookie, setLearnerCookie } from './learner-cookies';
import { LEARNER_COOKIE_OPTS } from './tokens';
import {
  learnerLoginSchema,
  learnerSignupSchema,
  type LearnerLoginDto,
  type LearnerSignupDto,
} from './dto/schemas';

@Public()
@Controller('learner')
export class LearnerAuthController {
  constructor(
    private readonly auth: LearnerAuthService,
    @Inject(LEARNER_COOKIE_OPTS) private readonly cookieOpts: { secure: boolean; ttlSec: number },
  ) {}

  @Post('signup')
  @RateLimit({ max: 10, windowSec: 60 })
  @HttpCode(201)
  async signup(
    @Body(new ZodValidationPipe(learnerSignupSchema)) dto: LearnerSignupDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const session = await this.auth.signup(dto);
    setLearnerCookie(res, session.accessToken, this.cookieOpts);
    return { learnerId: session.learnerId };
  }

  @Post('login')
  @RateLimit({ max: 20, windowSec: 60 })
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(learnerLoginSchema)) dto: LearnerLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const session = await this.auth.login(dto);
    setLearnerCookie(res, session.accessToken, this.cookieOpts);
    return { learnerId: session.learnerId };
  }

  @UseGuards(LearnerAuthGuard)
  @Get('me')
  me(@CurrentLearner() learner: AuthenticatedLearner) {
    return this.auth.me(learner.id);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: FastifyReply) {
    clearLearnerCookie(res);
    return { loggedOut: true };
  }
}
