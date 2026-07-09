import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';
import { prisma, Prisma } from '@eduforge/db';

const paletteSchema = z.object({
  key: z.string().min(2).max(30),
  name: z.string().min(2).max(60),
  colors: z.object({
    light: z.object({
      primary: z.string().min(4).max(9),
      secondary: z.string().min(4).max(9),
      accent: z.string().min(4).max(9),
    }),
    dark: z.object({
      primary: z.string().min(4).max(9),
      secondary: z.string().min(4).max(9),
      accent: z.string().min(4).max(9),
    }),
  }),
});

const templateSchema = z.object({
  key: z.string().min(2).max(30),
  name: z.string().min(2).max(60),
  tokens: z.object({}).passthrough(),
});

type PaletteDto = z.infer<typeof paletteSchema>;
type TemplateDto = z.infer<typeof templateSchema>;

@Controller('admin/catalog')
export class AdminCatalogController {
  /** Listar paletas */
  @Get('palettes')
  @Roles('admin', 'super_admin')
  async listPalettes() {
    return prisma.palette.findMany({ orderBy: { name: 'asc' } });
  }

  /** Criar paleta */
  @Post('palettes')
  @HttpCode(201)
  @Roles('admin', 'super_admin')
  async createPalette(@Body(new ZodValidationPipe(paletteSchema)) dto: PaletteDto) {
    const neutrosLight = { bg: '#ffffff', surface: '#f4f6f8', text: '#0f172a', muted: '#5b6472', border: '#e2e8f0' };
    const neutrosDark = { bg: '#0b1120', surface: '#141b2d', text: '#f8fafc', muted: '#94a3b8', border: '#1f2937' };
    return prisma.palette.create({
      data: {
        key: dto.key,
        name: dto.name,
        colors: {
          light: { ...neutrosLight, ...dto.colors.light },
          dark: { ...neutrosDark, ...dto.colors.dark },
        },
        wcagAa: true,
        published: true,
      },
    });
  }

  /** Atualizar paleta */
  @Put('palettes/:id')
  @Roles('admin', 'super_admin')
  async updatePalette(@Param('id') id: string, @Body(new ZodValidationPipe(paletteSchema)) dto: PaletteDto) {
    const neutrosLight = { bg: '#ffffff', surface: '#f4f6f8', text: '#0f172a', muted: '#5b6472', border: '#e2e8f0' };
    const neutrosDark = { bg: '#0b1120', surface: '#141b2d', text: '#f8fafc', muted: '#94a3b8', border: '#1f2937' };
    return prisma.palette.update({
      where: { id },
      data: {
        key: dto.key,
        name: dto.name,
        colors: {
          light: { ...neutrosLight, ...dto.colors.light },
          dark: { ...neutrosDark, ...dto.colors.dark },
        },
      },
    });
  }

  /** Excluir paleta */
  @Delete('palettes/:id')
  @Roles('admin', 'super_admin')
  async deletePalette(@Param('id') id: string) {
    await prisma.palette.delete({ where: { id } });
    return { deleted: true };
  }

  /** Listar templates */
  @Get('templates')
  @Roles('admin', 'super_admin')
  async listTemplates() {
    return prisma.template.findMany({ orderBy: { name: 'asc' } });
  }

  /** Criar template */
  @Post('templates')
  @HttpCode(201)
  @Roles('admin', 'super_admin')
  async createTemplate(@Body(new ZodValidationPipe(templateSchema)) dto: TemplateDto) {
    return prisma.template.create({
      data: {
        key: dto.key,
        name: dto.name,
        tokens: dto.tokens as Prisma.InputJsonValue,
        published: true,
      },
    });
  }

  /** Atualizar template */
  @Put('templates/:id')
  @Roles('admin', 'super_admin')
  async updateTemplate(@Param('id') id: string, @Body(new ZodValidationPipe(templateSchema)) dto: TemplateDto) {
    return prisma.template.update({
      where: { id },
      data: {
        key: dto.key,
        name: dto.name,
        tokens: dto.tokens as Prisma.InputJsonValue,
      },
    });
  }

  /** Excluir template */
  @Delete('templates/:id')
  @Roles('admin', 'super_admin')
  async deleteTemplate(@Param('id') id: string) {
    await prisma.template.delete({ where: { id } });
    return { deleted: true };
  }
}
