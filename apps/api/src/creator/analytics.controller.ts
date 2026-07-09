import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';
import { dateRangeSchema, resolveRange, type DateRangeDto } from './dto/schemas';

/** Analytics de aprendizagem por app (RF-10). */
@Controller('projects')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get(':id/analytics/summary')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(dateRangeSchema)) query: DateRangeDto,
  ) {
    const { from, to } = resolveRange(query);
    return this.analytics.summary(id, user.id, from, to);
  }

  @Get(':id/analytics/heatmap')
  heatmap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(dateRangeSchema)) query: DateRangeDto,
  ) {
    const { from, to } = resolveRange(query);
    return this.analytics.heatmap(id, user.id, from, to);
  }

  /** Exportação CSV do mapa de calor de dificuldade (RF-10). */
  @Get(':id/analytics/heatmap.csv')
  async heatmapCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(dateRangeSchema)) query: DateRangeDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { from, to } = resolveRange(query);
    const csv = await this.analytics.heatmapCsv(id, user.id, from, to);
    res.header('content-type', 'text/csv; charset=utf-8');
    res.header('content-disposition', `attachment; filename="heatmap-${id}.csv"`);
    return csv;
  }
}
