import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { RequireScope } from '../common/decorators';
import { prisma } from '@eduforge/db';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';

const submitSchema = z.object({
  templateKey: z.string().min(2).max(30),
  templateName: z.string().min(2).max(60),
  paletteKey: z.string().min(2).max(30),
  paletteName: z.string().min(2).max(60),
  colors: z.object({ primary: z.string(), secondary: z.string(), accent: z.string() }),
  authorName: z.string().min(2).max(60),
});

@Controller('marketplace')
export class MarketplaceController {
  @Get()
  @RequireScope('design:read')
  async list() {
    return prisma.marketplaceSubmission.findMany({
      where: { status: 'approved' },
      orderBy: { downloads: 'desc' },
      take: 50,
    });
  }

  @Post()
  @HttpCode(201)
  @RequireScope('design:write')
  async submit(@Body(new ZodValidationPipe(submitSchema)) dto: z.infer<typeof submitSchema>) {
    return prisma.marketplaceSubmission.create({ data: { ...dto, downloads: 0, status: 'pending' } as any });
  }

  @Put(':id/approve')
  @RequireScope('design:write')
  async approve(@Param('id') id: string) {
    return prisma.marketplaceSubmission.update({ where: { id }, data: { status: 'approved' } as any });
  }

  @Delete(':id')
  @RequireScope('design:write')
  async remove(@Param('id') id: string) {
    await prisma.marketplaceSubmission.delete({ where: { id } });
    return { removed: true };
  }
}

// Schema da tabela (a ser adicionada via migration):
// model MarketplaceSubmission {
//   id String @id @default(uuid()) @db.Uuid
//   templateKey String; templateName String
//   paletteKey String; paletteName String
//   colors Json
//   authorName String
//   downloads Int @default(0)
//   status String @default("pending")
//   createdAt DateTime @default(now())
//   @@map("marketplace_submissions")
// }
