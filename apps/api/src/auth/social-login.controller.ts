import { Controller, Get, Post, Body, Query, Res, Req } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators';
import { AuthService } from './auth.service';

function extractDevice(req: FastifyRequest) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

/**
 * Mock OAuth Controller (M14)
 * Simula o fluxo de login social sem depender de provedores externos neste estágio local.
 */
@Public()
@Controller('auth/social')
export class SocialLoginController {
  constructor(private readonly auth: AuthService) {}

  @Get('mock/login')
  login(@Query('redirect_uri') redirectUri: string, @Res() res: FastifyReply) {
    if (!redirectUri) {
      return res.status(400).send('redirect_uri is required');
    }
    const code = 'mock_oauth_code_google_user';
    return res.redirect(`${redirectUri}?code=${code}`);
  }

  @Post('mock/exchange')
  async exchange(@Body() body: { code: string }, @Req() req: FastifyRequest) {
    if (body.code !== 'mock_oauth_code_google_user') {
      throw new Error('invalid_code');
    }
    const device = extractDevice(req);
    return this.auth.socialLogin({
      email: 'marina@exemplo.com',
      name: 'Marina Silva (Mock Google)',
      device,
    });
  }
}
