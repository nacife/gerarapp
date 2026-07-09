import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser, RequireScope, type AuthenticatedUser } from '../common/decorators';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  /** Status de qualquer job assíncrono + progresso por etapa (Parte 6.B). */
  @Get(':id')
  @RequireScope('jobs:read')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const job = await this.jobs.get(id, user.id);
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      error: job.error,
    };
  }
}
