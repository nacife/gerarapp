import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { prisma } from '@eduforge/db';

@Controller('admin/analytics-v2')
export class AnalyticsV2Controller {
  @Get('retention')
  @Roles('admin', 'super_admin')
  async retention() {
    // Coorte semanal: % de aprendizes que voltam na semana seguinte
    const weeks: { label: string; newLearners: number; returnedNextWeek: number; retentionPct: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const start = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
      const newLearners = await prisma.learningEvent.count({
        where: { createdAt: { gte: start, lt: end } },
        distinct: ['enrollmentId'],
      });
      const nextStart = end;
      const nextEnd = new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000);
      const returned = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT le.enrollment_id) as count
        FROM learning_events le
        WHERE le.occurred_at >= ${nextStart} AND le.occurred_at < ${nextEnd}
          AND le.enrollment_id IN (
            SELECT DISTINCT le2.enrollment_id FROM learning_events le2
            WHERE le2.occurred_at >= ${start} AND le2.occurred_at < ${end}
          )
      `;
      const count = newLearners > 0 ? Math.round((Number(returned[0]?.count ?? 0) / newLearners) * 100) : 0;
      weeks.push({ label: `Semana ${5 - i}`, newLearners, returnedNextWeek: Number(returned[0]?.count ?? 0), retentionPct: count });
    }
    return { weeks };
  }

  @Get('dropout-risk')
  @Roles('admin', 'super_admin')
  async dropoutRisk() {
    // Aprendizes sem atividade há 7+ dias com < 50% de conclusão
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const atRisk = await prisma.$queryRaw<{ enrollment_id: string; learner_name: string; last_activity: string; completion_pct: number }[]>`
      SELECT e.id as enrollment_id, u.name as learner_name,
        MAX(le.occurred_at) as last_activity,
        COUNT(DISTINCT lp.content_block_id) * 100 / (SELECT COUNT(*) FROM content_blocks cb
          JOIN content_maps cm ON cm.id = cb.content_map_id
          WHERE cm.project_id = e.project_id AND cm.approved_at IS NOT NULL
        ) as completion_pct
      FROM enrollments e
      JOIN users u ON u.id = e.learner_id
      LEFT JOIN learning_events le ON le.enrollment_id = e.id
      LEFT JOIN learning_progress lp ON lp.enrollment_id = e.id AND lp.mastery > 0
      GROUP BY e.id, u.name, e.project_id
      HAVING MAX(le.occurred_at) < ${weekAgo.toISOString()}
         AND COUNT(DISTINCT lp.content_block_id) * 100 / (
           SELECT COUNT(*) FROM content_blocks cb
           JOIN content_maps cm ON cm.id = cb.content_map_id
           WHERE cm.project_id = e.project_id AND cm.approved_at IS NOT NULL
         ) < 50
      LIMIT 50
    `;
    return { atRiskCount: atRisk.length, atRisk };
  }
}
