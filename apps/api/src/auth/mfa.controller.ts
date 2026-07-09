import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { AllowWithoutMfa, CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { mfaCodeSchema, type MfaCodeDto } from './dto/schemas';

@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  /** Passo 1 — gera segredo pendente e otpauth para o QR code. */
  @AllowWithoutMfa()
  @Post('setup')
  @HttpCode(200)
  async setup(@CurrentUser() user: AuthenticatedUser) {
    return this.mfa.setup(user.id);
  }

  /** Passo 2 — confirma o código e ativa o MFA (retorna códigos de backup). */
  @AllowWithoutMfa()
  @Post('enable')
  @HttpCode(200)
  async enable(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(mfaCodeSchema)) dto: MfaCodeDto,
  ) {
    return this.mfa.enable(user.id, dto.code);
  }

  @Post('disable')
  @HttpCode(200)
  async disable(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(mfaCodeSchema)) dto: MfaCodeDto,
  ) {
    await this.mfa.disable(user.id, dto.code);
    return { disabled: true };
  }
}
