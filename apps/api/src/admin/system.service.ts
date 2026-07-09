import { prisma, Prisma } from '@eduforge/db';
import IORedis from 'ioredis';
import { getEnv } from '@eduforge/config';
import { Errors } from '../common/errors';
import { AuditService } from './audit.service';

export class SystemService {
  constructor(private readonly audit: AuditService) {}

  async getHealth() {
    const env = getEnv();

    // DB check
    let dbOk = false;
    try { await prisma.$queryRaw(Prisma.sql`SELECT 1`); dbOk = true; } catch {}

    // Redis check
    let redisOk = false;
    try {
      const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
      await redis.ping();
      redisOk = true;
      redis.disconnect();
    } catch {}

    // Queue stats
    const queueStats = await this.getQueueStats();

    // User counts
    const [totalUsers, activeUsers, suspendedUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { status: 'suspended' } }),
    ]);

    // Project counts
    const [totalProjects, publishedProjects] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { activeAppVersionId: { not: null } } }),
    ]);

    // Credit consumption (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const creditAgg = await prisma.aiCreditLedger.aggregate({
      where: { createdAt: { gte: weekAgo }, delta: { lt: 0 } },
      _sum: { delta: true },
    });

    return {
      uptime: process.uptime(),
      nodeVersion: process.version,
      memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      db: dbOk ? 'ok' : 'error',
      redis: redisOk ? 'ok' : 'error',
      queues: queueStats,
      users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers },
      projects: { total: totalProjects, published: publishedProjects },
      creditsConsumed7d: Math.abs(creditAgg._sum.delta ?? 0),
    };
  }

  private async getQueueStats() {
    const env = getEnv();
    const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
    const queues = ['ingest', 'generate', 'tts', 'inpi-package', 'sensei-embed', 'webhook-delivery'];

    const stats: Record<string, unknown> = {};
    for (const q of queues) {
      try {
        const waiting = await redis.llen(`bull:${q}:wait`);
        const active = await redis.llen(`bull:${q}:active`);
        const failed = await redis.llen(`bull:${q}:failed`);
        const completed = await redis.llen(`bull:${q}:completed`);
        stats[q] = { waiting, active, failed, completed };
      } catch {
        stats[q] = { error: 'unavailable' };
      }
    }
    redis.disconnect();
    return stats;
  }

  async listAuditLogs() {
    return this.audit.list(200);
  }

  async changeRole(userId: string, role: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) throw Errors.notFound('Usuário');

    await prisma.user.update({ where: { id: userId }, data: { role: role as 'learner' | 'creator' | 'admin' | 'support' | 'org_admin' | 'super_admin' } });

    return { userId, previousRole: user.role, newRole: role };
  }

  async resetMfa(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, mfa: true } });
    if (!user) throw Errors.notFound('Usuário');

    await prisma.user.update({ where: { id: userId }, data: { mfa: Prisma.DbNull } });

    return { userId, mfaReset: true };
  }
}
