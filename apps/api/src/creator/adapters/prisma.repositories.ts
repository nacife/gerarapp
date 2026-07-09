import { prisma } from '@eduforge/db';
import { collectBlockIds, type Manifest } from '@eduforge/schemas';
import { hasPendingChanges } from '../domain/pending-changes';
import type { AnswerEvent, ChapterBlocks } from '../domain/analytics';
import type {
  AnalyticsRawData,
  AnalyticsRepository,
  HomeProjectRow,
  HomeRepository,
  PlanUsage,
  ThemeColors,
} from '../ports';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function extractColors(palette: unknown): ThemeColors | null {
  const p = palette as { light?: { primary?: string; accent?: string } } | null;
  if (!p?.light?.primary) return null;
  return { primary: p.light.primary, accent: p.light.accent ?? p.light.primary };
}

export class PrismaHomeRepository implements HomeRepository {
  async listProjectsForOwner(ownerId: string): Promise<HomeProjectRow[]> {
    const projects = await prisma.project.findMany({
      where: { ownerUserId: ownerId },
      orderBy: { createdAt: 'desc' },
      include: { activeAppVersion: { include: { theme: true } } },
    });

    const weekAgo = new Date(Date.now() - WEEK_MS);
    const rows: HomeProjectRow[] = [];

    for (const p of projects) {
      const [latestContentMap, latestInteraction, latestTheme, interactionCount, weekEvents, certificatesThisWeek] =
        await Promise.all([
          prisma.contentMap.findFirst({
            where: { projectId: p.id },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
          prisma.interaction.findFirst({
            where: { projectId: p.id },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
          }),
          prisma.theme.findFirst({
            where: { projectId: p.id },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.interaction.count({ where: { projectId: p.id, appVersionId: null } }),
          prisma.learningEvent.findMany({
            where: { occurredAt: { gte: weekAgo }, enrollment: { projectId: p.id } },
            select: { enrollmentId: true, occurredAt: true },
          }),
          prisma.certificate.count({
            where: { issuedAt: { gte: weekAgo }, enrollment: { projectId: p.id } },
          }),
        ]);

      const daySet = new Set(
        weekEvents.map((e) => `${e.enrollmentId}:${e.occurredAt.toISOString().slice(0, 10)}`),
      );

      const pending = hasPendingChanges({
        publishedAt: p.activeAppVersion?.publishedAt ?? null,
        latestContentMapCreatedAt: latestContentMap?.createdAt ?? null,
        latestInteractionUpdatedAt: latestInteraction?.updatedAt ?? null,
        latestThemeCreatedAt: latestTheme?.createdAt ?? null,
      });

      const theme = p.activeAppVersion?.theme ?? latestTheme;

      rows.push({
        id: p.id,
        slug: p.slug,
        title: p.title,
        status: p.status,
        accessMode: p.accessMode,
        createdAt: p.createdAt,
        publishedAt: p.activeAppVersion?.publishedAt ?? null,
        themeColors: theme ? extractColors(theme.palette) : null,
        pendingChanges: pending,
        sessionsThisWeek: daySet.size,
        certificatesThisWeek,
        interactionCount,
      });
    }
    return rows;
  }

  async getPlanUsage(ownerId: string): Promise<PlanUsage> {
    const [subscription, appsCount, storageAgg, creditsAgg] = await Promise.all([
      prisma.subscription.findFirst({
        where: { userId: ownerId, status: 'active' },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where: { ownerUserId: ownerId } }),
      prisma.sourceFile.aggregate({
        where: { project: { ownerUserId: ownerId } },
        _sum: { sizeBytes: true },
      }),
      prisma.aiCreditLedger.aggregate({ where: { userId: ownerId }, _sum: { delta: true } }),
    ]);

    const plan = subscription?.plan;
    const limits = (plan?.limits as {
      apps?: number;
      uploadMb?: number;
      aiCreditsMonthly?: number;
      customDomains?: number;
    } | null) ?? { apps: 1, uploadMb: 50, aiCreditsMonthly: 200, customDomains: 0 };

    return {
      planKey: plan?.key ?? 'free',
      limits: {
        apps: limits.apps ?? 1,
        uploadMb: limits.uploadMb ?? 50,
        aiCreditsMonthly: limits.aiCreditsMonthly ?? 200,
        customDomains: limits.customDomains ?? 0,
      },
      usage: {
        apps: appsCount,
        storageBytes: Number(storageAgg._sum.sizeBytes ?? 0n),
        aiCreditsBalance: creditsAgg._sum.delta ?? 0,
      },
    };
  }
}

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  async getRawData(projectId: string, from: Date, to: Date): Promise<AnalyticsRawData | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { activeAppVersion: true },
    });
    if (!project?.activeAppVersion) return null;

    const manifest = project.activeAppVersion.manifest as unknown as Manifest;
    const chapters: ChapterBlocks[] = manifest.content.chapters.map((ch) => ({
      chapterId: ch.id,
      chapterTitle: ch.title,
      blockIds: collectBlockIds({ chapters: [ch] }),
    }));

    const enrollments = await prisma.enrollment.findMany({
      where: { projectId },
      select: { id: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);

    const events = await prisma.learningEvent.findMany({
      where: { enrollmentId: { in: enrollmentIds }, occurredAt: { gte: from, lte: to } },
      select: {
        enrollmentId: true,
        event: true,
        detail: true,
        occurredAt: true,
        interaction: { select: { id: true, type: true, contentBlockId: true } },
      },
    });

    const doneBlocksByEnrollment = new Map<string, Set<string>>();
    const touchedBlocksByEnrollment = new Map<string, Set<string>>();
    const answerEvents: AnswerEvent[] = [];
    const daySet = new Set<string>();
    const activeUserSet = new Set<string>();

    for (const e of events) {
      activeUserSet.add(e.enrollmentId);
      daySet.add(`${e.enrollmentId}:${e.occurredAt.toISOString().slice(0, 10)}`);

      const blockId = e.interaction?.contentBlockId;
      if (!blockId) continue;

      const touched = touchedBlocksByEnrollment.get(e.enrollmentId) ?? new Set<string>();
      touched.add(blockId);
      touchedBlocksByEnrollment.set(e.enrollmentId, touched);

      if (e.event !== 'answer' && e.event !== 'complete') continue;
      const detail = e.detail as { correct?: boolean } | null;

      if (detail?.correct === true) {
        const done = doneBlocksByEnrollment.get(e.enrollmentId) ?? new Set<string>();
        done.add(blockId);
        doneBlocksByEnrollment.set(e.enrollmentId, done);
      }
      if (typeof detail?.correct === 'boolean' && e.interaction) {
        answerEvents.push({
          interactionId: e.interaction.id,
          interactionType: e.interaction.type,
          contentBlockId: blockId,
          correct: detail.correct,
        });
      }
    }

    return {
      chapters,
      enrollmentIds,
      doneBlocksByEnrollment,
      touchedBlocksByEnrollment,
      answerEvents,
      sessions: daySet.size,
      activeUsers: activeUserSet.size,
    };
  }
}
