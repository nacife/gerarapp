import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { prisma } from '@eduforge/db';

@Controller('admin/analytics')
export class AnalyticsAdminController {
  @Get('overview')
  @Roles('admin', 'super_admin')
  async overview() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, usersToday, usersThisWeek, usersThisMonth,
      totalProjects, projectsToday,
      totalCreditsConsumed, creditsThisMonth,
      totalInteractions,
      totalEnrollments,
      topProjects,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.project.count(),
      prisma.project.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.aiCreditLedger.aggregate({ where: { delta: { lt: 0 } }, _sum: { delta: true } }),
      prisma.aiCreditLedger.aggregate({ where: { delta: { lt: 0 }, createdAt: { gte: monthAgo } }, _sum: { delta: true } }),
      prisma.interaction.count(),
      prisma.enrollment.count(),
      prisma.project.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, slug: true, _count: { select: { enrollments: true } } } }),
    ]);

    return {
      users: { total: totalUsers, today: usersToday, thisWeek: usersThisWeek, thisMonth: usersThisMonth },
      projects: { total: totalProjects, today: projectsToday },
      credits: { consumedTotal: Math.abs(totalCreditsConsumed._sum.delta ?? 0), consumedThisMonth: Math.abs(creditsThisMonth._sum.delta ?? 0) },
      interactions: totalInteractions,
      enrollments: totalEnrollments,
      topProjects: topProjects.map((p: any) => ({ id: p.id, title: p.title, slug: p.slug, enrollments: p._count.enrollments })),
    };
  }

  @Get('growth')
  @Roles('admin', 'super_admin')
  async growth() {
    // Last 12 weeks of user registrations
    const weeks: { label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
      const count = await prisma.user.count({ where: { createdAt: { gte: start, lt: end } } });
      weeks.push({ label: `Semana ${12 - i}`, count });
    }
    return { weeks };
  }
}
