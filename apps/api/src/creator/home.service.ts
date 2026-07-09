import { buildHighlights } from './domain/highlights';
import { displayStatus } from './domain/pending-changes';
import type { HomeRepository } from './ports';

export class HomeService {
  constructor(private readonly repo: HomeRepository) {}

  async getHome(ownerId: string) {
    const [projects, planUsage] = await Promise.all([
      this.repo.listProjectsForOwner(ownerId),
      this.repo.getPlanUsage(ownerId),
    ]);

    const highlights = buildHighlights(
      projects.map((p) => ({
        title: p.title,
        sessionsThisWeek: p.sessionsThisWeek,
        certificatesThisWeek: p.certificatesThisWeek,
      })),
    );

    return {
      projects: projects.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        displayStatus: displayStatus(p.status, p.pendingChanges),
        accessMode: p.accessMode,
        createdAt: p.createdAt,
        publishedAt: p.publishedAt,
        themeColors: p.themeColors,
        sessionsThisWeek: p.sessionsThisWeek,
        interactionCount: p.interactionCount,
      })),
      planUsage,
      highlights,
    };
  }
}
