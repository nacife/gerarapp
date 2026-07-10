import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { prisma } from '@eduforge/db';

@Controller('admin/sso')
export class SsoController {
  @Get('config/:orgId')
  @Roles('admin', 'super_admin')
  async getConfig(@Param('orgId') orgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, ssoConfig: true } });
    return org ?? { error: 'not found' };
  }

  @Post('config/:orgId')
  @Roles('admin', 'super_admin')
  async saveConfig(@Param('orgId') orgId: string, @Body() body: { provider: string; clientId: string; clientSecret: string; domain: string }) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { ssoConfig: { provider: body.provider, clientId: body.clientId, domain: body.domain } as any },
    });
    return { saved: true, provider: body.provider };
  }
}
