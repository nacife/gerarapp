import { Prisma, prisma } from '@eduforge/db';
import type { Manifest } from '@eduforge/schemas';
import { toDateIso } from '../domain/date';
import type {
  CertificateRecord,
  CertificateRepository,
  EnrolledLearnerRow,
  EnrollmentRecord,
  EnrollmentRepository,
  EventRepository,
  InteractionForGrading,
  LearnerRecord,
  LearnerRepository,
  ProgressRepository,
  ProgressRow,
  PublicProjectInfo,
} from '../ports';

function dateFromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export class PrismaLearnerRepository implements LearnerRepository {
  async findByEmail(email: string): Promise<LearnerRecord | null> {
    return prisma.learner.findUnique({ where: { email } });
  }
  async findById(id: string): Promise<LearnerRecord | null> {
    return prisma.learner.findUnique({ where: { id } });
  }
  async create(input: { email: string; name: string; passwordHash: string }): Promise<LearnerRecord> {
    return prisma.learner.create({ data: input });
  }
}

function mapEnrollment(row: {
  id: string;
  learnerId: string;
  projectId: string;
  xp: number;
  streakDays: number;
  lastActivityAt: Date | null;
  streakFreezeUsedAt: Date | null;
}): EnrollmentRecord {
  return {
    id: row.id,
    learnerId: row.learnerId,
    projectId: row.projectId,
    xp: row.xp,
    streakDays: row.streakDays,
    lastActivityAt: row.lastActivityAt ? toDateIso(row.lastActivityAt) : null,
    streakFreezeUsedAt: row.streakFreezeUsedAt ? toDateIso(row.streakFreezeUsedAt) : null,
  };
}

export class PrismaEnrollmentRepository implements EnrollmentRepository {
  async findPublicProjectBySlug(slug: string): Promise<PublicProjectInfo | null> {
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        accessMode: true,
        accessSecret: true,
        activeAppVersion: { select: { manifest: true } },
      },
    });
    if (!project) return null;
    return {
      id: project.id,
      slug: project.slug,
      title: project.title,
      accessMode: project.accessMode,
      accessSecret: project.accessSecret,
      manifest: project.activeAppVersion ? (project.activeAppVersion.manifest as unknown as Manifest) : null,
    };
  }

  async isInvited(projectId: string, email: string): Promise<boolean> {
    return (await prisma.projectInvite.count({ where: { projectId, email } })) > 0;
  }

  async findByLearnerAndProject(learnerId: string, projectId: string): Promise<EnrollmentRecord | null> {
    const row = await prisma.enrollment.findUnique({ where: { learnerId_projectId: { learnerId, projectId } } });
    return row ? mapEnrollment(row) : null;
  }

  async create(input: {
    learnerId: string;
    projectId: string;
    pinnedVersionId: string | null;
  }): Promise<EnrollmentRecord> {
    const row = await prisma.enrollment.create({
      data: { learnerId: input.learnerId, projectId: input.projectId, pinnedVersionId: input.pinnedVersionId },
    });
    return mapEnrollment(row);
  }

  async findByIdForLearner(id: string, learnerId: string): Promise<EnrollmentRecord | null> {
    const row = await prisma.enrollment.findFirst({ where: { id, learnerId } });
    return row ? mapEnrollment(row) : null;
  }

  async findById(id: string): Promise<EnrollmentRecord | null> {
    const row = await prisma.enrollment.findUnique({ where: { id } });
    return row ? mapEnrollment(row) : null;
  }

  async getCertificateContext(
    enrollmentId: string,
  ): Promise<{ learnerName: string; projectTitle: string } | null> {
    const row = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { learner: { select: { name: true } }, project: { select: { title: true } } },
    });
    return row ? { learnerName: row.learner.name, projectTitle: row.project.title } : null;
  }

  async updateGamification(
    id: string,
    patch: { xp?: number; streakDays?: number; lastActivityAt?: string; streakFreezeUsedAt?: string | null },
  ): Promise<void> {
    await prisma.enrollment.update({
      where: { id },
      data: {
        xp: patch.xp,
        streakDays: patch.streakDays,
        lastActivityAt: patch.lastActivityAt ? dateFromIso(patch.lastActivityAt) : undefined,
        streakFreezeUsedAt:
          patch.streakFreezeUsedAt === undefined
            ? undefined
            : patch.streakFreezeUsedAt === null
              ? null
              : dateFromIso(patch.streakFreezeUsedAt),
      },
    });
  }

  async getActiveManifest(projectId: string): Promise<Manifest | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { activeAppVersion: { select: { manifest: true } } },
    });
    return project?.activeAppVersion ? (project.activeAppVersion.manifest as unknown as Manifest) : null;
  }

  async listForProject(projectId: string): Promise<EnrolledLearnerRow[]> {
    const rows = await prisma.enrollment.findMany({
      where: { projectId },
      orderBy: { enrolledAt: 'desc' },
      include: { learner: { select: { name: true, email: true } }, certificate: { select: { id: true } } },
    });
    return rows.map((r) => ({
      enrollmentId: r.id,
      learnerName: r.learner.name,
      learnerEmail: r.learner.email,
      xp: r.xp,
      streakDays: r.streakDays,
      enrolledAt: r.enrolledAt,
      certificateIssued: !!r.certificate,
    }));
  }

  async getLeaderboard(
    slug: string,
  ): Promise<{ enrollmentId: string; learnerName: string; xp: number }[]> {
    const rows = await prisma.enrollment.findMany({
      where: {
        project: { slug, activeAppVersionId: { not: null } },
      },
      orderBy: { xp: 'desc' },
      take: 10,
      select: {
        id: true,
        xp: true,
        learner: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      enrollmentId: r.id,
      learnerName: r.learner.name,
      xp: r.xp,
    }));
  }

  async addInvite(projectId: string, email: string): Promise<void> {
    await prisma.projectInvite.upsert({
      where: { projectId_email: { projectId, email } },
      update: {},
      create: { projectId, email },
    });
  }
}

function mapProgress(row: {
  contentBlockId: string;
  mastery: number;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date | null;
}): ProgressRow {
  return { ...row };
}

export class PrismaProgressRepository implements ProgressRepository {
  async get(enrollmentId: string, contentBlockId: string): Promise<ProgressRow | null> {
    const row = await prisma.learnerProgress.findUnique({
      where: { enrollmentId_contentBlockId: { enrollmentId, contentBlockId } },
    });
    return row ? mapProgress(row) : null;
  }

  async upsert(
    enrollmentId: string,
    contentBlockId: string,
    patch: Omit<ProgressRow, 'contentBlockId'>,
  ): Promise<void> {
    await prisma.learnerProgress.upsert({
      where: { enrollmentId_contentBlockId: { enrollmentId, contentBlockId } },
      update: patch,
      create: { enrollmentId, contentBlockId, ...patch },
    });
  }

  /** Reduzido em memória (volume baixo no MVP); otimizar com índice/coluna materializada na escala. */
  async completedBlockIds(enrollmentId: string): Promise<string[]> {
    const events = await prisma.learningEvent.findMany({
      where: { enrollmentId, event: { in: ['answer', 'complete'] } },
      select: { detail: true, interaction: { select: { contentBlockId: true } } },
    });
    const done = new Set<string>();
    for (const e of events) {
      const detail = e.detail as { correct?: boolean } | null;
      const blockId = e.interaction?.contentBlockId;
      if (blockId && detail?.correct === true) done.add(blockId);
    }
    return [...done];
  }
}

export class PrismaEventRepository implements EventRepository {
  async create(input: {
    enrollmentId: string;
    interactionId: string | null;
    event: 'view' | 'answer' | 'complete';
    detail: unknown;
  }): Promise<{ id: string }> {
    const row = await prisma.learningEvent.create({
      data: {
        enrollmentId: input.enrollmentId,
        interactionId: input.interactionId,
        event: input.event,
        detail: (input.detail as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
    return { id: row.id };
  }

  async hasAwardedXp(enrollmentId: string, interactionId: string): Promise<boolean> {
    const events = await prisma.learningEvent.findMany({
      where: { enrollmentId, interactionId, event: { in: ['answer', 'complete'] } },
      select: { detail: true },
    });
    return events.some((e) => (e.detail as { correct?: boolean } | null)?.correct === true);
  }

  async findInteraction(id: string): Promise<InteractionForGrading | null> {
    const row = await prisma.interaction.findUnique({ where: { id } });
    if (!row) return null;
    const payload = row.payload as { xp?: number };
    return {
      id: row.id,
      projectId: row.projectId,
      contentBlockId: row.contentBlockId,
      type: row.type,
      payload: row.payload,
      xp: typeof payload?.xp === 'number' ? payload.xp : 10,
    };
  }
}

export class PrismaCertificateRepository implements CertificateRepository {
  async findByEnrollment(enrollmentId: string): Promise<CertificateRecord | null> {
    return prisma.certificate.findUnique({ where: { enrollmentId } });
  }

  async findByVerifyCode(
    code: string,
  ): Promise<(CertificateRecord & { learnerName: string; projectTitle: string }) | null> {
    const row = await prisma.certificate.findUnique({
      where: { verifyCode: code },
      include: { enrollment: { include: { learner: true, project: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      verifyCode: row.verifyCode,
      pdfS3Key: row.pdfS3Key,
      issuedAt: row.issuedAt,
      learnerName: row.enrollment.learner.name,
      projectTitle: row.enrollment.project.title,
    };
  }

  async create(input: {
    enrollmentId: string;
    verifyCode: string;
    pdfS3Key: string;
  }): Promise<CertificateRecord> {
    return prisma.certificate.create({ data: input });
  }
}
