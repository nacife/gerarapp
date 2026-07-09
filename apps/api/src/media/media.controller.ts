import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser, Public, RequireScope, type AuthenticatedUser } from '../common/decorators';
import { MediaService } from './media.service';

@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Gera podcast para um capítulo (criador, dono do projeto). */
  @Post('projects/:id/chapters/:chapterId/podcast')
  @HttpCode(202)
  @RequireScope('content:write')
  generatePodcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.media.generatePodcast(id, user.id, chapterId);
  }

  /** Gera ilustração IA para um capítulo (síncrono). */
  @Post('projects/:id/chapters/:chapterId/illustration')
  @HttpCode(201)
  @RequireScope('content:write')
  generateIllustration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.media.generateIllustration(id, user.id, chapterId);
  }

  /** Lista mídia do projeto (criador). */
  @Get('projects/:id/media')
  @RequireScope('projects:read')
  listProjectMedia(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.media.listProjectMedia(id, user.id);
  }
}

@Public()
@Controller('public')
export class PublicMediaController {
  constructor(private readonly media: MediaService) {}

  /** Lista mídia pública do app (runtime/aprendiz). */
  @Get('apps/:slug/media')
  listPublicMedia(@Param('slug') slug: string) {
    return this.media.listPublicMedia(slug);
  }
}
