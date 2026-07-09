import { Errors } from '../common/errors';
import {
  computeAbandonmentFunnel,
  computeCompletionByChapter,
  computeDifficultyHeatmap,
  toCsv,
} from './domain/analytics';
import type { ProjectRepository } from '../projects/ports';
import type { AnalyticsRepository } from './ports';

export class AnalyticsService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly analytics: AnalyticsRepository,
  ) {}

  async summary(projectId: string, ownerId: string, from: Date, to: Date) {
    if (!(await this.projects.findByIdForOwner(projectId, ownerId))) throw Errors.notFound('Projeto');
    const data = await this.analytics.getRawData(projectId, from, to);
    if (!data) return { published: false as const };

    return {
      published: true as const,
      sessions: data.sessions,
      activeUsers: data.activeUsers,
      completionByChapter: computeCompletionByChapter(data.chapters, data.enrollmentIds, data.doneBlocksByEnrollment),
      abandonmentFunnel: computeAbandonmentFunnel(data.chapters, data.enrollmentIds, data.touchedBlocksByEnrollment),
      totalEnrollments: data.enrollmentIds.length,
    };
  }

  async heatmap(projectId: string, ownerId: string, from: Date, to: Date) {
    if (!(await this.projects.findByIdForOwner(projectId, ownerId))) throw Errors.notFound('Projeto');
    const data = await this.analytics.getRawData(projectId, from, to);
    if (!data) return { published: false as const, rows: [] };
    return { published: true as const, rows: computeDifficultyHeatmap(data.answerEvents) };
  }

  async heatmapCsv(projectId: string, ownerId: string, from: Date, to: Date): Promise<string> {
    const { rows } = await this.heatmap(projectId, ownerId, from, to);
    return toCsv(rows as unknown as Record<string, unknown>[]);
  }
}
