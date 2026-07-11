import { prisma } from '@eduforge/db';

export interface TopicRetention { topic: string; retention: number; events: number }
export interface DnaProfile {
  learnerId: string; enrollmentId: string; computedAt: string;
  topics: TopicRetention[]; bestHour: number;
  bestInteractionTypes: { type: string; accuracy: number; count: number }[];
  pace: number; activeDays: number; xp: number; completionPercent: number;
}

const STOP_WORDS = new Set(['de','da','do','em','no','na','que','e','o','a','os','as','um','uma','para','com','se','não','é','foi','por','dos','das']);

function extractKeywords(md: string): string[] {
  return md.toLowerCase().replace(/[#*_`>\[\]()]/g, '').split(/[\s,.;:!?]+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

export class LearningDnaService {
  async computeProfile(enrollmentId: string, learnerId: string): Promise<DnaProfile | null> {
    const enrollment = await prisma.enrollment.findFirst({ where: { id: enrollmentId, learnerId }, select: { id: true, xp: true, projectId: true } });
    if (!enrollment) return null;

    const events = await prisma.learningEvent.findMany({
      where: { enrollmentId, event: 'answer', interactionId: { not: null } },
      orderBy: { occurredAt: 'asc' },
      select: { detail: true, occurredAt: true, interaction: { select: { type: true, contentBlockId: true } } },
    });

    if (events.length === 0) {
      return { learnerId, enrollmentId, computedAt: new Date().toISOString(), topics: [], bestHour: 0, bestInteractionTypes: [], pace: 0, activeDays: 0, xp: enrollment.xp, completionPercent: 0 };
    }

    const blockIds = [...new Set(events.map(e => e.interaction?.contentBlockId).filter(Boolean))] as string[];
    const blocks = blockIds.length > 0 ? await prisma.contentBlock.findMany({ where: { id: { in: blockIds } }, select: { id: true, contentMd: true } }) : [];
    const blockKeywords = new Map<string, string[]>();
    for (const b of blocks) blockKeywords.set(b.id, extractKeywords(b.contentMd));

    const topicCorrect = new Map<string, number>(), topicTotal = new Map<string, number>();
    for (const ev of events) {
      const bid = ev.interaction?.contentBlockId; if (!bid) continue;
      const keywords = blockKeywords.get(bid) ?? [];
      const correct = (ev.detail as any)?.correct === true;
      for (const kw of keywords) { topicTotal.set(kw, (topicTotal.get(kw) ?? 0) + 1); if (correct) topicCorrect.set(kw, (topicCorrect.get(kw) ?? 0) + 1); }
    }
    const topics: TopicRetention[] = [...topicTotal.entries()].filter(([, t]) => t >= 2).map(([topic, total]) => ({ topic, retention: (topicCorrect.get(topic) ?? 0) / total, events: total })).sort((a, b) => b.retention - a.retention).slice(0, 10);

    const hourCorrect = new Map<number, number>(), hourTotal = new Map<number, number>();
    for (const ev of events) { const h = new Date(ev.occurredAt).getHours(); hourTotal.set(h, (hourTotal.get(h) ?? 0) + 1); if ((ev.detail as any)?.correct === true) hourCorrect.set(h, (hourCorrect.get(h) ?? 0) + 1); }
    let bestHour = 9, bestRate = 0;
    for (const [h, total] of hourTotal) { const rate = (hourCorrect.get(h) ?? 0) / total; if (rate > bestRate && total >= 2) { bestRate = rate; bestHour = h; } }

    const typeCorrect = new Map<string, number>(), typeTotal = new Map<string, number>();
    for (const ev of events) { const t = ev.interaction?.type ?? 'unknown'; typeTotal.set(t, (typeTotal.get(t) ?? 0) + 1); if ((ev.detail as any)?.correct === true) typeCorrect.set(t, (typeCorrect.get(t) ?? 0) + 1); }
    const bestInteractionTypes = [...typeTotal.entries()].map(([type, count]) => ({ type, accuracy: (typeCorrect.get(type) ?? 0) / count, count })).sort((a, b) => b.accuracy - a.accuracy);

    const days = new Set(events.map(e => new Date(e.occurredAt).toISOString().slice(0, 10)));
    const pace = events.length / (days.size || 1);
    const completedBlocks = await prisma.learnerProgress.count({ where: { enrollmentId, mastery: { gt: 0 } } });
    const totalBlocks = await prisma.contentBlock.count({ where: { contentMap: { projectId: enrollment.projectId, approvedAt: { not: null } } } });
    const completionPercent = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

    return { learnerId, enrollmentId, computedAt: new Date().toISOString(), topics, bestHour, bestInteractionTypes, pace: Math.round(pace * 10) / 10, activeDays: days.size, xp: enrollment.xp, completionPercent };
  }

  async getCreatorAggregate(projectId: string) {
    const enrollments = await prisma.enrollment.findMany({ where: { projectId }, select: { id: true, learnerId: true } });
    const profiles: DnaProfile[] = [];
    for (const e of enrollments) { const p = await this.computeProfile(e.id, e.learnerId); if (p) profiles.push(p); }
    if (profiles.length === 0) return { learnerCount: 0, commonWeaknesses: [], bestHours: [], avgCompletion: 0 };
    const topicRetentions = new Map<string, number[]>();
    for (const p of profiles) for (const t of p.topics) { const arr = topicRetentions.get(t.topic) ?? []; arr.push(t.retention); topicRetentions.set(t.topic, arr); }
    const commonWeaknesses = [...topicRetentions.entries()].map(([topic, rets]) => ({ topic, avgRetention: Math.round(rets.reduce((a, b) => a + b, 0) / rets.length * 100) })).filter(w => w.avgRetention < 60).sort((a, b) => a.avgRetention - b.avgRetention).slice(0, 8);
    const hourCounts = new Map<number, number>(); for (const p of profiles) hourCounts.set(p.bestHour, (hourCounts.get(p.bestHour) ?? 0) + 1);
    const bestHours = [...hourCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h);
    const avgCompletion = Math.round(profiles.reduce((s, p) => s + p.completionPercent, 0) / profiles.length);
    return { learnerCount: profiles.length, commonWeaknesses, bestHours, avgCompletion };
  }
}
