import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, Public, RequireScope, type AuthenticatedUser } from '../common/decorators';
import { CurrentLearner, LearnerAuthGuard } from '../learning/learner-auth.guard';
import type { AuthenticatedLearner } from '../learning/learner-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SenseiService } from './sensei.service';
import { askSenseiSchema, senseiConfigSchema, type AskSenseiDto, type SenseiConfigDto } from './dto/schemas';

/** Rotas do criador (autenticadas por sessão/API key). */
@Controller()
export class SenseiController {
  constructor(private readonly sensei: SenseiService) {}

  @Get('projects/:id/sensei')
  @RequireScope('projects:read')
  getConfig(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sensei.getConfig(id, user.id);
  }

  @Put('projects/:id/sensei')
  @RequireScope('projects:write')
  setConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(senseiConfigSchema)) dto: SenseiConfigDto,
  ) {
    return this.sensei.setConfig(id, user.id, dto);
  }
}

/** Rotas públicas / de aprendiz (runtime). */
@Public()
@Controller('public')
export class SenseiPublicController {
  constructor(private readonly sensei: SenseiService) {}

  /** Config pública do Sensei + flag indexed (runtime, sem autenticação). */
  @Get('apps/:slug/sensei')
  getPublicConfig(@Param('slug') slug: string) {
    return this.sensei.getPublicConfig(slug);
  }

  /** Pergunta do aprendiz ao Sensei (autenticado como learner). */
  @HttpCode(200)
  @Post('enrollments/:id/sensei/ask')
  @UseGuards(LearnerAuthGuard)
  ask(
    @Param('id') enrollmentId: string,
    @CurrentLearner() learner: AuthenticatedLearner,
    @Body(new ZodValidationPipe(askSenseiSchema)) dto: AskSenseiDto,
  ) {
    return this.sensei.ask(enrollmentId, learner.id, dto);
  }
}
