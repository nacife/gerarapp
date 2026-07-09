import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';
import { prisma, Prisma } from '@eduforge/db';

const planSchema = z.object({
  key: z.string().min(2).max(30),
  name: z.string().min(2).max(60),
  priceCentsMonth: z.number().int().min(0).default(0),
  limits: z.object({
    projects: z.number().int().min(1).default(3),
    storageMb: z.number().int().min(1).default(100),
    learnersPerProject: z.number().int().min(1).default(50),
    aiCreditsMonthly: z.number().int().min(0).default(100),
  }),
  minTier: z.number().int().min(0).default(0),
});
type PlanDto = z.infer<typeof planSchema>;

@Controller('admin/plans')
export class PlansController {
  @Get()
  @Roles('admin', 'super_admin')
  async list() {
    return prisma.plan.findMany({ orderBy: { minTier: 'asc' } });
  }

  @Post()
  @HttpCode(201)
  @Roles('admin', 'super_admin')
  async create(@Body(new ZodValidationPipe(planSchema)) dto: PlanDto) {
    return prisma.plan.create({ data: dto as any });
  }

  @Put(':id')
  @Roles('admin', 'super_admin')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(planSchema)) dto: PlanDto) {
    return prisma.plan.update({ where: { id }, data: dto as any });
  }

  @Delete(':id')
  @Roles('admin', 'super_admin')
  async delete(@Param('id') id: string) {
    await prisma.plan.delete({ where: { id } });
    return { deleted: true };
  }
}
