import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';
import { prisma, Prisma } from '@eduforge/db';

const createCaseSchema = z.object({
  projectId: z.string().uuid(),
  source: z.enum(['classifier', 'report', 'dmca']),
  evidence: z.record(z.unknown()).optional(),
});
const updateCaseSchema = z.object({
  status: z.enum(['reviewing', 'resolved', 'takedown']),
  resolution: z.string().max(500).optional(),
});
type CreateCaseDto = z.infer<typeof createCaseSchema>;
type UpdateCaseDto = z.infer<typeof updateCaseSchema>;

@Controller('admin/moderation')
export class ModerationController {
  @Get('cases')
  @Roles('admin', 'super_admin', 'support')
  async listCases() {
    return prisma.moderationCase.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { project: { select: { id: true, title: true, slug: true } }, assignee: { select: { id: true, name: true, email: true } } },
    });
  }

  @Get('cases/:id')
  @Roles('admin', 'super_admin', 'support')
  async getCase(@Param('id') id: string) {
    return prisma.moderationCase.findUnique({
      where: { id },
      include: { project: { select: { id: true, title: true, slug: true } }, assignee: { select: { id: true, name: true } } },
    });
  }

  @Post('cases')
  @Roles('admin', 'super_admin', 'support')
  async createCase(@Body(new ZodValidationPipe(createCaseSchema)) dto: CreateCaseDto) {
    return prisma.moderationCase.create({ data: dto as any });
  }

  @Patch('cases/:id')
  @Roles('admin', 'super_admin')
  async updateCase(@Param('id') id: string, @Body(new ZodValidationPipe(updateCaseSchema)) dto: UpdateCaseDto) {
    return prisma.moderationCase.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.resolution ? { evidence: { resolution: dto.resolution } as any } : {}),
      },
    });
  }

  @Post('cases/:id/claim')
  @Roles('admin', 'super_admin', 'support')
  async claimCase(@Param('id') id: string, @Body() body: { assigneeId: string }) {
    return prisma.moderationCase.update({ where: { id }, data: { assigneeId: body.assigneeId, status: 'reviewing' } });
  }
}
