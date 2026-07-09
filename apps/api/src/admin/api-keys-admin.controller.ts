import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { prisma } from '@eduforge/db';

@Controller('admin/api-keys')
export class ApiKeysAdminController {
  @Get()
  @Roles('admin', 'super_admin')
  async listAll() {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        prefix: true,
        scopes: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return keys.map((k) => ({
      id: k.id,
      prefix: k.prefix,
      scopes: k.scopes,
      revoked: !!k.revokedAt,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
      user: k.user,
    }));
  }

  @Delete(':id')
  @Roles('admin', 'super_admin')
  async revoke(@Param('id') id: string) {
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  @Get('stats')
  @Roles('admin', 'super_admin')
  async stats() {
    const [total, active, revoked, uniqueUsers] = await Promise.all([
      prisma.apiKey.count(),
      prisma.apiKey.count({ where: { revokedAt: null } }),
      prisma.apiKey.count({ where: { revokedAt: { not: null } } }),
      prisma.apiKey.groupBy({ by: ['userId'], _count: true }),
    ]);
    return { total, active, revoked, uniqueUsers: uniqueUsers.length };
  }
}
