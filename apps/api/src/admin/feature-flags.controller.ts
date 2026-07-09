import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CurrentUser, Roles, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FeatureFlagsService } from './feature-flags.service';
import {
  createFlagSchema,
  pinFlagSchema,
  updateFlagSchema,
  type CreateFlagDto,
  type PinFlagDto,
  type UpdateFlagDto,
} from './dto/schemas';

/** Feature flags com rollout % (RF-13, US-ADM-01). */
@Controller('admin/feature-flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Roles('admin', 'super_admin')
  @Get()
  list() {
    return this.flags.list();
  }

  @Roles('admin', 'super_admin')
  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(createFlagSchema)) dto: CreateFlagDto,
  ) {
    return this.flags.create(actor, dto);
  }

  @Roles('admin', 'super_admin')
  @Put(':key')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(updateFlagSchema)) dto: UpdateFlagDto,
  ) {
    return this.flags.update(actor, key, dto);
  }

  /** Fixa (ou libera) o estado da flag para um usuário/org/plano específico. */
  @Roles('admin', 'super_admin')
  @Post(':key/pin')
  @HttpCode(200)
  pin(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(pinFlagSchema)) dto: PinFlagDto,
  ) {
    return this.flags.pinForSubject(actor, key, dto.subjectType, dto.subjectId, dto.enabled);
  }
}
