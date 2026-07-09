import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminUsersService } from './admin-users.service';
import { AuditService } from './audit.service';
import {
  grantCreditsSchema,
  searchUsersSchema,
  suspendSchema,
  type GrantCreditsDto,
  type SearchUsersDto,
  type SuspendDto,
} from './dto/schemas';

/** Gestão de usuários (RF-12). Toda ação de escrita gera audit_logs (US-ADM-01). */
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly admin: AdminUsersService,
    private readonly audit: AuditService,
  ) {}

  @Roles('admin', 'super_admin', 'support')
  @Get()
  search(@Query(new ZodValidationPipe(searchUsersSchema)) query: SearchUsersDto) {
    return this.admin.search(query.query, query.status, 50);
  }

  @Roles('admin', 'super_admin', 'support')
  @Get(':id')
  get360(@Param('id') id: string) {
    return this.admin.get360(id);
  }

  @Roles('admin', 'super_admin', 'support')
  @Get(':id/audit-logs')
  auditLogs(@Param('id') id: string) {
    return this.audit.listForTarget('user', id);
  }

  @Roles('admin', 'super_admin')
  @Post(':id/suspend')
  @HttpCode(200)
  async suspend(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(suspendSchema)) dto: SuspendDto,
  ) {
    await this.admin.suspend(actor, id, dto.reason);
    return { suspended: true };
  }

  @Roles('admin', 'super_admin')
  @Post(':id/reactivate')
  @HttpCode(200)
  async reactivate(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    await this.admin.reactivate(actor, id);
    return { reactivated: true };
  }

  @Roles('admin', 'super_admin')
  @Post(':id/force-password-reset')
  @HttpCode(202)
  async forcePasswordReset(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    await this.admin.forcePasswordReset(actor, id);
    return { emailSent: true };
  }

  @Roles('admin', 'super_admin')
  @Post(':id/revoke-sessions')
  @HttpCode(200)
  revokeSessions(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.revokeSessions(actor, id);
  }

  @Roles('admin', 'super_admin')
  @Post(':id/credits')
  @HttpCode(201)
  async grantCredits(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(grantCreditsSchema)) dto: GrantCreditsDto,
  ) {
    await this.admin.grantCredits(actor, id, dto.delta, dto.reason);
    return { granted: true };
  }

  @Roles('admin', 'super_admin', 'support')
  @Post(':id/impersonate')
  @HttpCode(201)
  impersonate(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.impersonate(actor, id);
  }
}
