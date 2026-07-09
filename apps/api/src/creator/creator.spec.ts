import { describe, expect, it } from 'vitest';
import { AppError } from '../common/errors';
import { InMemoryProjectRepository } from '../projects/testing/fakes';
import { AnalyticsService } from './analytics.service';
import { HomeService } from './home.service';
import type { AnalyticsRawData, AnalyticsRepository, HomeProjectRow, HomeRepository, PlanUsage } from './ports';

const OWNER = 'owner-1';

class FakeHomeRepository implements HomeRepository {
  rows: HomeProjectRow[] = [];
  usage: PlanUsage = {
    planKey: 'free',
    limits: { apps: 1, uploadMb: 50, aiCreditsMonthly: 200, customDomains: 0 },
    usage: { apps: 0, storageBytes: 0, aiCreditsBalance: 0 },
  };
  async listProjectsForOwner(): Promise<HomeProjectRow[]> {
    return this.rows;
  }
  async getPlanUsage(): Promise<PlanUsage> {
    return this.usage;
  }
}

class FakeAnalyticsRepository implements AnalyticsRepository {
  data: AnalyticsRawData | null = null;
  async getRawData(): Promise<AnalyticsRawData | null> {
    return this.data;
  }
}

async function expectError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('esperava AppError');
}

describe('HomeService (RF-08)', () => {
  it('agrega projetos, uso do plano e destaques', async () => {
    const repo = new FakeHomeRepository();
    repo.rows = [
      {
        id: 'p1',
        slug: 'bio',
        title: 'Biologia Viva',
        status: 'published',
        accessMode: 'public',
        createdAt: new Date(),
        publishedAt: new Date('2026-07-01'),
        themeColors: { primary: '#0ea5e9', accent: '#22d3ee' },
        pendingChanges: false,
        sessionsThisWeek: 214,
        certificatesThisWeek: 3,
        interactionCount: 12,
      },
      {
        id: 'p2',
        slug: 'financas',
        title: 'Finanças 101',
        status: 'draft',
        accessMode: 'public',
        createdAt: new Date(),
        publishedAt: null,
        themeColors: null,
        pendingChanges: false,
        sessionsThisWeek: 0,
        certificatesThisWeek: 0,
        interactionCount: 0,
      },
    ];
    repo.usage.usage = { apps: 2, storageBytes: 42_000_000, aiCreditsBalance: 320 };

    const service = new HomeService(repo);
    const home = await service.getHome(OWNER);

    expect(home.projects).toHaveLength(2);
    expect(home.projects[0]!.displayStatus).toBe('published');
    expect(home.projects[1]!.displayStatus).toBe('draft');
    expect(home.planUsage.usage.apps).toBe(2);
    expect(home.highlights[0]).toContain('Biologia Viva');
    expect(home.highlights.some((h) => h.includes('3 certificados'))).toBe(true);
  });

  it('projeto publicado com mudanças pendentes aparece como pending_update', async () => {
    const repo = new FakeHomeRepository();
    repo.rows = [
      {
        id: 'p1',
        slug: 'bio',
        title: 'Bio',
        status: 'published',
        accessMode: 'public',
        createdAt: new Date(),
        publishedAt: new Date(),
        themeColors: null,
        pendingChanges: true,
        sessionsThisWeek: 0,
        certificatesThisWeek: 0,
        interactionCount: 1,
      },
    ];
    const home = await new HomeService(repo).getHome(OWNER);
    expect(home.projects[0]!.displayStatus).toBe('pending_update');
  });
});

describe('AnalyticsService (RF-10)', () => {
  it('projeto não publicado retorna published:false', async () => {
    const projects = new InMemoryProjectRepository();
    const project = projects.seedProject(OWNER);
    const analyticsRepo = new FakeAnalyticsRepository();
    analyticsRepo.data = null;

    const service = new AnalyticsService(projects, analyticsRepo);
    const res = await service.summary(project.id, OWNER, new Date(0), new Date());
    expect(res.published).toBe(false);
  });

  it('calcula sessões, usuários ativos e conclusão por capítulo', async () => {
    const projects = new InMemoryProjectRepository();
    const project = projects.seedProject(OWNER);
    const analyticsRepo = new FakeAnalyticsRepository();
    analyticsRepo.data = {
      chapters: [{ chapterId: 'c1', chapterTitle: 'Cap 1', blockIds: ['b1'] }],
      enrollmentIds: ['e1', 'e2'],
      doneBlocksByEnrollment: new Map([['e1', new Set(['b1'])]]),
      touchedBlocksByEnrollment: new Map([
        ['e1', new Set(['b1'])],
        ['e2', new Set(['b1'])],
      ]),
      answerEvents: [
        { interactionId: 'i1', interactionType: 'quiz', contentBlockId: 'b1', correct: true },
        { interactionId: 'i1', interactionType: 'quiz', contentBlockId: 'b1', correct: false },
      ],
      sessions: 5,
      activeUsers: 2,
    };

    const service = new AnalyticsService(projects, analyticsRepo);
    const summary = await service.summary(project.id, OWNER, new Date(0), new Date());
    if (!summary.published) throw new Error('esperava published:true');
    expect(summary.sessions).toBe(5);
    expect(summary.activeUsers).toBe(2);
    expect(summary.completionByChapter[0]!.pct).toBe(50);
    expect(summary.abandonmentFunnel[0]!.pct).toBe(100);

    const heatmap = await service.heatmap(project.id, OWNER, new Date(0), new Date());
    expect(heatmap.rows[0]!.errorRatePct).toBe(50);

    const csv = await service.heatmapCsv(project.id, OWNER, new Date(0), new Date());
    expect(csv).toContain('interactionId');
    expect(csv).toContain('i1');
  });

  it('projeto de outro dono é rejeitado (multi-tenant)', async () => {
    const projects = new InMemoryProjectRepository();
    const project = projects.seedProject(OWNER);
    const service = new AnalyticsService(projects, new FakeAnalyticsRepository());
    const err = await expectError(() => service.summary(project.id, 'intruso', new Date(0), new Date()));
    expect(err.slug).toBe('not-found');
  });
});
