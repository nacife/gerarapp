import { Controller, Get, Param, Patch, Body, Query } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { prisma } from '@eduforge/db';

@Controller('admin/orgs')
export class OrgsController {
  @Get()
  @Roles('admin', 'super_admin')
  async listOrgs(@Query('page') page = '1') {
    const pageNum = parseInt(page, 10) || 1;
    const limit = 50;
    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        skip: (pageNum - 1) * limit,
        take: limit,
        include: { memberships: { select: { id: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organization.count(),
    ]);

    return {
      data: orgs.map((o) => ({ ...o, memberCount: o.memberships.length })),
      meta: { page: pageNum, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  @Get(':id')
  @Roles('admin', 'super_admin')
  async getOrg(@Param('id') id: string) {
    return prisma.organization.findUnique({
      where: { id },
      include: {
        memberships: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
  }

  @Patch(':id/status')
  @Roles('super_admin')
  updateOrg(@Param('id') _id: string, @Body() _body: { active: boolean }) {
    return { status: 'Not implemented' };
  }
}
