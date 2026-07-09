import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, RequireScope, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InteractionsService } from './interactions.service';
import {
  editInteractionSchema,
  generateSchema,
  type EditInteractionDto,
  type GenerateDto,
} from './dto/schemas';
import type { InteractionRecord } from './ports';

function view(it: InteractionRecord) {
  return {
    id: it.id,
    contentBlockId: it.contentBlockId,
    type: it.type,
    payload: it.payload,
    difficulty: it.difficulty,
    origin: it.origin,
    position: it.position,
  };
}

@Controller('projects')
export class ProjectInteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Post(':id/interactions/generate')
  @HttpCode(202)
  @RequireScope('ai:invoke')
  async generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(generateSchema)) dto: GenerateDto,
  ) {
    return this.interactions.generate(id, user.id, { density: dto.density, types: dto.types });
  }

  @Get(':id/interactions')
  @RequireScope('content:read')
  async list(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return (await this.interactions.list(id, user.id)).map(view);
  }
}

@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Patch(':id')
  @RequireScope('content:write')
  async edit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(editInteractionSchema)) dto: EditInteractionDto,
  ) {
    return view(await this.interactions.edit(id, user.id, dto.payload));
  }

  @Delete(':id')
  @HttpCode(200)
  @RequireScope('content:write')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.interactions.remove(id, user.id);
    return { deleted: true };
  }

  @Post(':id/regenerate')
  @HttpCode(200)
  @RequireScope('ai:invoke')
  async regenerate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return view(await this.interactions.regenerate(id, user.id));
  }
}
