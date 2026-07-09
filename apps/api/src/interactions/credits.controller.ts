import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { CreditsService } from './credits.service';

@Controller('credits')
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get('balance')
  balance(@CurrentUser() user: AuthenticatedUser) {
    return this.credits.balance(user.id);
  }

  @Get('ledger')
  ledger(@CurrentUser() user: AuthenticatedUser) {
    return this.credits.ledger(user.id);
  }
}
