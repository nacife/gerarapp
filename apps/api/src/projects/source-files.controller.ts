import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser, RequireScope, type AuthenticatedUser } from '../common/decorators';
import { SourceFilesService } from './source-files.service';

@Controller('source-files')
export class SourceFilesController {
  constructor(private readonly sourceFiles: SourceFilesService) {}

  /** Enfileira a ingestão do arquivo (Parte 6.B: retorna job_id). */
  @Post(':id/ingest')
  @HttpCode(202)
  @RequireScope('content:write')
  async ingest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sourceFiles.startIngest(id, user.id);
  }
}
