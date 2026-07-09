import { collectBlockIds, type Manifest } from '@eduforge/schemas';
import { Errors } from '../common/errors';
import type { SecretHasher } from '../studio/ports';
import type { WebhooksService } from '../webhooks/webhooks.service';
import { annotateChapters, type AnnotatedNode } from './domain/annotate';
import { computeAchievements, type Achievement, type AchievementStats } from './domain/achievements';
import type {
  CertificateRepository,
  EnrolledLearnerRow,
  EnrollmentRepository,
  ProgressRepository,
} from './ports';

export interface ProgressSnapshot {
  xp: number;
  streakDays: number;
  percent: number;
  totalBlocks: number;
  doneBlocks: number;
  chapters: AnnotatedNode[];
  certificate: { verifyCode: string; issuedAt: Date } | null;
}

export class EnrollmentService {
  constructor(
    private readonly repo: EnrollmentRepository,
    private readonly progressRepo: ProgressRepository,
    private readonly certificates: CertificateRepository,
    private readonly hasher: SecretHasher,
    private readonly webhooks: WebhooksService,
  ) {}

  async enroll(input: {
    slug: string;
    learnerId: string;
    learnerEmail: string;
    accessKey?: string;
  }): Promise<{ enrollmentId: string; manifest: Manifest }> {
    const project = await this.repo.findPublicProjectBySlug(input.slug);
    if (!project) throw Errors.notFound('App');
    if (!project.manifest) throw Errors.appNotPublished();

    if (project.accessMode === 'password') {
      const ok =
        !!input.accessKey &&
        !!project.accessSecret &&
        (await this.hasher.verify(project.accessSecret, input.accessKey));
      if (!ok) throw Errors.appLocked();
    } else if (project.accessMode === 'invite') {
      const invited = await this.repo.isInvited(project.id, input.learnerEmail);
      if (!invited) throw Errors.notInvited();
    }

    const existing = await this.repo.findByLearnerAndProject(input.learnerId, project.id);
    const enrollment =
      existing ??
      (await this.repo.create({ learnerId: input.learnerId, projectId: project.id, pinnedVersionId: null }));

    if (!existing) {
      await this.webhooks.dispatchForProject(project.id, 'learner.enrolled', {
        enrollmentId: enrollment.id,
        learnerEmail: input.learnerEmail,
      });
    }

    return { enrollmentId: enrollment.id, manifest: project.manifest };
  }

  async getProgress(enrollmentId: string, learnerId: string): Promise<ProgressSnapshot> {
    const enrollment = await this.repo.findByIdForLearner(enrollmentId, learnerId);
    if (!enrollment) throw Errors.notFound('Matrícula');
    const manifest = await this.repo.getActiveManifest(enrollment.projectId);
    if (!manifest) throw Errors.appNotPublished();

    const totalBlocks = collectBlockIds(manifest.content);
    const done = new Set(await this.progressRepo.completedBlockIds(enrollmentId));
    const doneCount = totalBlocks.filter((id) => done.has(id)).length;
    const percent = totalBlocks.length ? Math.round((doneCount / totalBlocks.length) * 100) : 0;
    const certificate = await this.certificates.findByEnrollment(enrollmentId);

    return {
      xp: enrollment.xp,
      streakDays: enrollment.streakDays,
      percent,
      totalBlocks: totalBlocks.length,
      doneBlocks: doneCount,
      chapters: annotateChapters(manifest.content, done),
      certificate: certificate ? { verifyCode: certificate.verifyCode, issuedAt: certificate.issuedAt } : null,
    };
  }

  listForProject(projectId: string): Promise<EnrolledLearnerRow[]> {
    return this.repo.listForProject(projectId);
  }

  addInvite(projectId: string, email: string): Promise<void> {
    return this.repo.addInvite(projectId, email.toLowerCase());
  }

  /** Conquistas do aprendiz (RF-06.7) — computadas do estado existente. */
  async getAchievements(enrollmentId: string, learnerId: string): Promise<Achievement[]> {
    const progress = await this.getProgress(enrollmentId, learnerId);
    const cert = await this.certificates.findByEnrollment(enrollmentId);

    const stats: AchievementStats = {
      doneBlocks: progress.doneBlocks,
      totalBlocks: progress.totalBlocks,
      xp: progress.xp,
      streakDays: progress.streakDays,
      completed: progress.percent >= 100,
      certificateIssued: !!cert,
    };

    return computeAchievements(stats);
  }

  /** Ranking do app publicado (top 10 XP, nome abreviado). */
  async getLeaderboard(slug: string) {
    const project = await this.repo.findPublicProjectBySlug(slug);
    if (!project) throw Errors.notFound('App');
    if (!project.manifest) throw Errors.appNotPublished();

    const rows = await this.repo.getLeaderboard(slug);
    return rows.map((r) => ({
      enrollmentId: r.enrollmentId,
      name: abbreviateName(r.learnerName),
      xp: r.xp,
    }));
  }
}

/** Abrevia "Marina Silva" → "Marina S." (primeiro nome + inicial do último). */
function abbreviateName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? full;
  const first = parts[0]!;
  const lastInitial = parts[parts.length - 1]![0]!;
  return `${first} ${lastInitial}.`;
}
