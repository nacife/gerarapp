import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';
import { prisma } from '@eduforge/db';

const orgSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(60),
  planKey: z.enum(['free', 'pro', 'business']).default('free'),
});

const addMemberSchema = z.object({ userId: z.string().uuid(), role: z.enum(['org_admin', 'creator']).default('creator') });

type OrgDto = z.infer<typeof orgSchema>;
type AddMemberDto = z.infer<typeof addMemberSchema>;

@Controller('admin/orgs')
export class OrgsController {
  @Get()
  @Roles('admin', 'super_admin', 'support')
  async list() {
    return prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true, projects: true } } },
    });
  }

  @Get(':id')
  @Roles('admin', 'super_admin', 'support')
  async get(@Param('id') id: string) {
    return prisma.organization.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        projects: { select: { id: true, title: true, slug: true } },
      },
    });
  }

  @Post()
  @HttpCode(201)
  @Roles('admin', 'super_admin')
  async create(@Body(new ZodValidationPipe(orgSchema)) dto: OrgDto) {
    return prisma.organization.create({ data: dto });
  }

  @Put(':id')
  @Roles('admin', 'super_admin')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(orgSchema)) dto: OrgDto) {
    return prisma.organization.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @Roles('admin', 'super_admin')
  async delete(@Param('id') id: string) {
    await prisma.organization.delete({ where: { id } });
    return { deleted: true };
  }

  @Post(':id/members')
  @HttpCode(201)
  @Roles('admin', 'super_admin')
  async addMember(@Param('id') id: string, @Body(new ZodValidationPipe(addMemberSchema)) dto: AddMemberDto) {
    return prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: id, userId: dto.userId } },
      create: { orgId: id, userId: dto.userId, role: dto.role },
      update: { role: dto.role },
    });
  }

  @Delete(':id/members/:userId')
  @Roles('admin', 'super_admin')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    await prisma.orgMember.delete({ where: { orgId_userId: { orgId: id, userId } } });
    return { removed: true };
  }
}
