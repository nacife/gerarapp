import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { Errors } from '../common/errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { ProjectRepository } from '../projects/ports';
import { EnrollmentService } from './enrollment.service';
import { inviteSchema, type InviteDto } from './dto/schemas';
import { PROJECT_REPOSITORY } from './tokens';

/** Gestão de aprendizes pelo criador (RF-04 modo invite; Parte 6.B). */
@Controller('projects')
export class LearnersController {
  constructor(
    private readonly enrollments: EnrollmentService,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
  ) {}

  @Get(':id/learners')
  async list(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const project = await this.projects.findByIdForOwner(id, user.id);
    if (!project) throw Errors.notFound('Projeto');
    return this.enrollments.listForProject(id);
  }

  @Post(':id/learners/invite')
  @HttpCode(201)
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(inviteSchema)) dto: InviteDto,
  ) {
    const project = await this.projects.findByIdForOwner(id, user.id);
    if (!project) throw Errors.notFound('Projeto');
    await this.enrollments.addInvite(id, dto.email);
    return { invited: true };
  }
}
