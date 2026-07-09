import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser, Public, RequireScope, type AuthenticatedUser } from '../common/decorators';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CatalogService } from './catalog.service';
import { PublicAppService } from './public-app.service';
import { StudioService } from './studio.service';
import {
  fromLogoSchema,
  rollbackSchema,
  setAccessSchema,
  setThemeSchema,
  type FromLogoDto,
  type RollbackDto,
  type SetAccessDto,
  type SetThemeDto,
} from './dto/schemas';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('templates')
  @RequireScope('design:read')
  templates() {
    return this.catalog.templates();
  }

  @Get('palettes')
  @RequireScope('design:read')
  palettes() {
    return this.catalog.palettes();
  }
}

@Controller('projects')
export class StudioController {
  constructor(private readonly studio: StudioService) {}

  @Get(':id/theme')
  getTheme(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.studio.getTheme(id, user.id);
  }

  @Put(':id/theme')
  @RequireScope('design:write')
  setTheme(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setThemeSchema)) dto: SetThemeDto,
  ) {
    return this.studio.setTheme(id, user.id, {
      templateKey: dto.template,
      palette: dto.palette,
      typography: dto.typography,
      effects: dto.effects,
    });
  }

  @Post(':id/theme/from-logo')
  @HttpCode(200)
  @RequireScope('design:write')
  fromLogo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(fromLogoSchema)) dto: FromLogoDto,
  ) {
    return this.studio.paletteFromLogo(id, user.id, dto.brand);
  }

  @Put(':id/access')
  @HttpCode(200)
  async setAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setAccessSchema)) dto: SetAccessDto,
  ) {
    await this.studio.setAccess(id, user.id, dto.mode, dto.password);
    return { mode: dto.mode };
  }

  @Post(':id/publish')
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  @RequireScope('publish')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.studio.publish(id, user.id);
  }

  @Post(':id/rollback')
  @HttpCode(200)
  @RequireScope('publish')
  rollback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rollbackSchema)) dto: RollbackDto,
  ) {
    return this.studio.rollback(id, user.id, dto.versionNumber);
  }

  @Get(':id/versions')
  @RequireScope('projects:read')
  versions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.studio.versions(id, user.id);
  }
}

@Controller('public')
export class PublicAppController {
  constructor(private readonly publicApp: PublicAppService) {}

  /** Manifesto do app publicado (respeita o modo de acesso). */
  @Public()
  @Get('apps/:slug')
  manifest(@Param('slug') slug: string, @Query('key') key?: string) {
    return this.publicApp.getManifest(slug, key);
  }
}
