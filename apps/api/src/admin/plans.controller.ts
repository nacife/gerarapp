import { Controller, Get, Param, Patch, Body } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { prisma } from '@eduforge/db';

@Controller('admin/plans')
export class PlansController {
  @Get()
  @Roles('admin', 'super_admin')
  async listPlans() {
    return prisma.plan.findMany({
      orderBy: { priceCentsMonth: 'asc' },
    });
  }

  @Get(':id')
  @Roles('admin', 'super_admin')
  async getPlan(@Param('id') id: string) {
    return prisma.plan.findUnique({ where: { id } });
  }

  @Patch(':id')
  @Roles('super_admin')
  async updatePlan(@Param('id') id: string, @Body() body: { name?: string; priceCentsMonth?: number }) {
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.priceCentsMonth !== undefined) data.priceCentsMonth = body.priceCentsMonth;
    if (Object.keys(data).length > 0) {
      return prisma.plan.update({ where: { id }, data });
    }
    return prisma.plan.findUnique({ where: { id } });
  }
}
