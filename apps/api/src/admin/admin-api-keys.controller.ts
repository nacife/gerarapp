import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles, type AuthenticatedUser } from '../common/decorators';
import { AdminApiKeysService } from './admin-api-keys.service';

/** Revogação de chaves de API por suporte/segurança (Parte 6.B.1: "Admin pode revogar qualquer chave"). */
@Controller('admin/api-keys')
export class AdminApiKeysController {
  constructor(private readonly adminApiKeys: AdminApiKeysService) {}

  @Roles('admin', 'super_admin', 'support')
  @Post(':id/revoke')
  @HttpCode(200)
  revoke(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.adminApiKeys.revoke(actor, id);
  }
}
