import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_SERVICE, AUTH_COOKIE_OPTS } from './tokens';
import type { AccessTokenService } from './domain/access-token';
import {
  clearAuthCookies,
  type CookieOptions,
  REFRESH_COOKIE,
  setAccessCookieOnly,
  setAuthCookies,
} from '../common/cookies';
import { AllowWithoutMfa, CurrentUser, Public, type AuthenticatedUser } from '../common/decorators';
import { Errors } from '../common/errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  emailSchema,
  loginMfaSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  tokenSchema,
  updateProfileSchema,
  type EmailDto,
  type LoginDto,
  type LoginMfaDto,
  type ResetPasswordDto,
  type SignupDto,
  type TokenDto,
  type UpdateProfileDto,
} from './dto/schemas';

const impersonateConsumeSchema = z.object({ token: z.string().min(1) });
type ImpersonateConsumeDto = z.infer<typeof impersonateConsumeSchema>;

const CONSENT_VERSION = '2026-07-05';

function deviceOf(req: FastifyRequest): { ip?: string; userAgent?: string } {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(AUTH_COOKIE_OPTS) private readonly cookieOpts: CookieOptions,
    @Inject(ACCESS_TOKEN_SERVICE) private readonly accessTokens: AccessTokenService,
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(201)
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) dto: SignupDto,
    @Req() req: FastifyRequest,
  ) {
    const { userId } = await this.auth.signup({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      locale: dto.locale,
      consentVersion: CONSENT_VERSION,
      ip: req.ip,
    });
    return { userId, verificationSent: true };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body(new ZodValidationPipe(tokenSchema)) dto: TokenDto) {
    await this.auth.verifyEmail(dto.token);
    return { verified: true };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(202)
  async resend(@Body(new ZodValidationPipe(emailSchema)) dto: EmailDto) {
    await this.auth.resendVerification(dto.email);
    return { accepted: true };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.auth.login({
      email: dto.email,
      password: dto.password,
      device: deviceOf(req),
    });
    if (result.status === 'mfa_required') {
      return { mfaRequired: true, challengeToken: result.challengeToken };
    }
    setAuthCookies(res, result.session, this.cookieOpts);
    return { mfaRequired: false, user: result.session.user };
  }

  @Public()
  @Post('login/mfa')
  @HttpCode(200)
  async loginMfa(
    @Body(new ZodValidationPipe(loginMfaSchema)) dto: LoginMfaDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const session = await this.auth.loginMfa({
      challengeToken: dto.challengeToken,
      code: dto.code,
      device: deviceOf(req),
    });
    setAuthCookies(res, session, this.cookieOpts);
    return { user: session.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: FastifyRequest & { cookies?: Record<string, string | undefined> },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) {
      clearAuthCookies(res);
      return { refreshed: false };
    }
    const session = await this.auth.refresh(raw, deviceOf(req));
    setAuthCookies(res, session, this.cookieOpts);
    return { refreshed: true, user: session.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: FastifyRequest & { cookies?: Record<string, string | undefined> },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) await this.auth.logout(raw);
    clearAuthCookies(res);
    return { loggedOut: true };
  }

  @AllowWithoutMfa()
  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const count = await this.auth.logoutAll(user.id);
    clearAuthCookies(res);
    return { revoked: count };
  }

  @AllowWithoutMfa()
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id, user.impersonatorId);
  }

  /** Perfil (nome, idioma) — RF-11. */
  @AllowWithoutMfa()
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(user.id, dto);
  }

  /** Sessões ativas do próprio usuário (RF-11). */
  @AllowWithoutMfa()
  @Get('sessions')
  async sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user.id);
  }

  @AllowWithoutMfa()
  @Delete('sessions/:id')
  @HttpCode(200)
  async revokeSession(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.auth.revokeSession(user.id, id);
    return { revoked: true };
  }

  /** Troca o token de impersonação (recebido do admin console) por um cookie de sessão. */
  @Public()
  @Post('impersonate/consume')
  @HttpCode(200)
  async consumeImpersonation(
    @Body(new ZodValidationPipe(impersonateConsumeSchema)) dto: ImpersonateConsumeDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const claims = this.accessTokens.verify(dto.token);
    if (!claims || !claims.impersonatorId) throw Errors.unauthorized();
    setAccessCookieOnly(res, dto.token, {
      secure: this.cookieOpts.secure,
      ttlSec: this.cookieOpts.accessTtlSec,
    });
    return { ok: true };
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(202)
  async forgot(@Body(new ZodValidationPipe(emailSchema)) dto: EmailDto) {
    await this.auth.requestPasswordReset(dto.email);
    return { accepted: true };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(200)
  async reset(@Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { reset: true };
  }
}
