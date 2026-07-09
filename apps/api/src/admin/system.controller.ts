import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';
import { SystemService } from './system.service';

const changeRoleSchema = z.object({ role: z.enum(['learner', 'creator', 'admin', 'support']) });
type ChangeRoleDto = z.infer<typeof changeRoleSchema>;

@Controller('admin')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  /** Dashboard de saúde do sistema */
  @Get('health')
  @Roles('admin', 'super_admin')
  getHealth() {
    return this.system.getHealth();
  }

  /** Logs de auditoria globais */
  @Get('audit-logs')
  @Roles('admin', 'super_admin')
  listAuditLogs() {
    return this.system.listAuditLogs();
  }

  /** Alterar papel do usuário */
  @Post('users/:id/role')
  @Roles('admin', 'super_admin')
  changeRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeRoleSchema)) dto: ChangeRoleDto,
  ) {
    return this.system.changeRole(id, dto.role);
  }

  /** Remover MFA do usuário */
  @Post('users/:id/reset-mfa')
  @Roles('admin', 'super_admin')
  resetMfa(@Param('id') id: string) {
    return this.system.resetMfa(id);
  }
}
