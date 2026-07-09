import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OperatorService } from './operator.service';
import {
  listQueueSchema,
  protocolSchema,
  rejectSchema,
  rpiEventSchema,
  updateChecklistSchema,
  type ListQueueDto,
  type ProtocolDto,
  type RejectDto,
  type RpiEventDto,
  type UpdateChecklistDto,
} from './dto/schemas';

/** Fila operacional do INPI no Admin (RF-17, wireframe C.6). Toda ação é auditada. */
@Controller('admin/inpi/filings')
export class OperatorFilingController {
  constructor(private readonly operator: OperatorService) {}

  @Roles('admin', 'super_admin', 'support')
  @Get()
  listQueue(@Query(new ZodValidationPipe(listQueueSchema)) query: ListQueueDto) {
    return this.operator.listQueue(query.status);
  }

  @Roles('admin', 'super_admin', 'support')
  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.operator.getDetail(id);
  }

  @Roles('admin', 'super_admin')
  @Post(':id/claim')
  @HttpCode(200)
  claim(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.operator.claim(actor, id);
  }

  @Roles('admin', 'super_admin')
  @Patch(':id/checklist')
  updateChecklist(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateChecklistSchema)) dto: UpdateChecklistDto,
  ) {
    return this.operator.updateChecklist(actor, id, dto);
  }

  @Roles('admin', 'super_admin')
  @Post(':id/protocol')
  @HttpCode(200)
  protocol(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(protocolSchema)) dto: ProtocolDto,
  ) {
    return this.operator.protocol(actor, id, dto);
  }

  @Roles('admin', 'super_admin')
  @Post(':id/rpi-event')
  @HttpCode(201)
  recordRpiEvent(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rpiEventSchema)) dto: RpiEventDto,
  ) {
    return this.operator.recordRpiEvent(actor, id, dto.note);
  }

  @Roles('admin', 'super_admin')
  @Post(':id/certificate/upload-url')
  @HttpCode(200)
  certificateUploadUrl(@Param('id') id: string) {
    return this.operator.certificateUploadUrl(id);
  }

  @Roles('admin', 'super_admin')
  @Post(':id/grant')
  @HttpCode(200)
  grant(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.operator.grant(actor, id);
  }

  @Roles('admin', 'super_admin')
  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectSchema)) dto: RejectDto,
  ) {
    return this.operator.reject(actor, id, dto.reason);
  }
}
