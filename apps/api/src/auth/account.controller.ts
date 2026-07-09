import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AccountService } from './account.service';
import { AllowWithoutMfa, CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { Errors } from '../common/errors';

/** Endpoints LGPD do próprio usuário (§0.5.7). */
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** Exporta os dados pessoais do usuário. */
  @AllowWithoutMfa()
  @Get('export')
  async export(@CurrentUser() user: AuthenticatedUser) {
    return this.account.exportData(user.id);
  }

  /** Solicita exclusão da conta (anonimização assíncrona). Bloqueada durante impersonação. */
  @AllowWithoutMfa()
  @Post('delete')
  @HttpCode(202)
  async delete(@CurrentUser() user: AuthenticatedUser) {
    if (user.impersonatorId) throw Errors.forbidden();
    await this.account.requestDeletion(user.id);
    return { scheduled: true };
  }
}
