import { randomUUID } from 'node:crypto';
import type { Manifest } from '@eduforge/schemas';
import type {
  CertificateRecord,
  CertificateRepository,
  CertificateStorage,
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
  QrCodeGenerator,
  CertificatePdfBuilder,
} from '../ports';

export class InMemoryLearnerRepository implements LearnerRepository {
  rows: LearnerRecord[] = [];
  async findByEmail(email: string): Promise<LearnerRecord | null> {
    return this.rows.find((r) => r.email === email) ?? null;
  }
  async findById(id: string): Promise<LearnerRecord | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async create(input: { email: string; name: string; passwordHash: string }): Promise<LearnerRecord> {
    const row: LearnerRecord = { id: randomUUID(), ...input };
    this.rows.push(row);
    return row;
  }
}

interface SeedProjectOptions {
  slug: string;
  title: string;
  accessMode?: string;
  accessSecret?: string | null;
  manifest?: Manifest | null;
}

export class InMemoryEnrollmentRepository implements EnrollmentRepository {
  projects = new Map<string, PublicProjectInfo>();
  invites = new Map<string, Set<string>>();
  enrollments: EnrollmentRecord[] = [];
  learnerNames = new Map<string, string>();

  seedProject(opts: SeedProjectOptions): PublicProjectInfo {
    const info: PublicProjectInfo = {
      id: randomUUID(),
      slug: opts.slug,
      title: opts.title,
      accessMode: opts.accessMode ?? 'public',
      accessSecret: opts.accessSecret ?? null,
      manifest: opts.manifest ?? null,
    };
    this.projects.set(opts.slug, info);
    return info;
  }
  registerLearnerName(learnerId: string, name: string) {
    this.learnerNames.set(learnerId, name);
  }

  async findPublicProjectBySlug(slug: string): Promise<PublicProjectInfo | null> {
    return this.projects.get(slug) ?? null;
  }
  async isInvited(projectId: string, email: string): Promise<boolean> {
    return this.invites.get(projectId)?.has(email) ?? false;
  }
  async findByLearnerAndProject(learnerId: string, projectId: string): Promise<EnrollmentRecord | null> {
    return this.enrollments.find((e) => e.learnerId === learnerId && e.projectId === projectId) ?? null;
  }
  async create(input: {
    learnerId: string;
    projectId: string;
    pinnedVersionId: string | null;
  }): Promise<EnrollmentRecord> {
    const row: EnrollmentRecord = {
      id: randomUUID(),
      learnerId: input.learnerId,
      projectId: input.projectId,
      xp: 0,
      streakDays: 0,
      lastActivityAt: null,
      streakFreezeUsedAt: null,
    };
    this.enrollments.push(row);
    return row;
  }
  async findByIdForLearner(id: string, learnerId: string): Promise<EnrollmentRecord | null> {
    return this.enrollments.find((e) => e.id === id && e.learnerId === learnerId) ?? null;
  }
  async findById(id: string): Promise<EnrollmentRecord | null> {
    return this.enrollments.find((e) => e.id === id) ?? null;
  }
  async getCertificateContext(
    enrollmentId: string,
  ): Promise<{ learnerName: string; projectTitle: string } | null> {
    const e = this.enrollments.find((x) => x.id === enrollmentId);
    if (!e) return null;
    const project = [...this.projects.values()].find((p) => p.id === e.projectId);
    return { learnerName: this.learnerNames.get(e.learnerId) ?? 'Aprendiz', projectTitle: project?.title ?? '' };
  }
  async updateGamification(
    id: string,
    patch: { xp?: number; streakDays?: number; lastActivityAt?: string; streakFreezeUsedAt?: string | null },
  ): Promise<void> {
    const e = this.enrollments.find((x) => x.id === id);
    if (!e) return;
    if (patch.xp !== undefined) e.xp = patch.xp;
    if (patch.streakDays !== undefined) e.streakDays = patch.streakDays;
    if (patch.lastActivityAt !== undefined) e.lastActivityAt = patch.lastActivityAt;
    if (patch.streakFreezeUsedAt !== undefined) e.streakFreezeUsedAt = patch.streakFreezeUsedAt;
  }
  async getActiveManifest(projectId: string): Promise<Manifest | null> {
    return [...this.projects.values()].find((p) => p.id === projectId)?.manifest ?? null;
  }
  async listForProject(projectId: string): Promise<EnrolledLearnerRow[]> {
    return this.enrollments
      .filter((e) => e.projectId === projectId)
      .map((e) => ({
        enrollmentId: e.id,
        learnerName: this.learnerNames.get(e.learnerId) ?? 'Aprendiz',
        learnerEmail: 'x@example.com',
        xp: e.xp,
        streakDays: e.streakDays,
        enrolledAt: new Date(),
        certificateIssued: false,
      }));
  }
  async addInvite(projectId: string, email: string): Promise<void> {
    const set = this.invites.get(projectId) ?? new Set<string>();
    set.add(email);
    this.invites.set(projectId, set);
  }

  async getLeaderboard(
    _slug: string,
  ): Promise<{ enrollmentId: string; learnerName: string; xp: number }[]> {
    return [...this.enrollments]
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10)
      .map((r) => ({
        enrollmentId: r.id,
        learnerName: this.learnerNames.get(r.learnerId) ?? 'Anonymous',
        xp: r.xp,
      }));
  }
}

export class InMemoryProgressRepository implements ProgressRepository {
  rows = new Map<string, ProgressRow>();
  private key(enrollmentId: string, contentBlockId: string) {
    return `${enrollmentId}:${contentBlockId}`;
  }
  async get(enrollmentId: string, contentBlockId: string): Promise<ProgressRow | null> {
    return this.rows.get(this.key(enrollmentId, contentBlockId)) ?? null;
  }
  async upsert(
    enrollmentId: string,
    contentBlockId: string,
    patch: Omit<ProgressRow, 'contentBlockId'>,
  ): Promise<void> {
    this.rows.set(this.key(enrollmentId, contentBlockId), { contentBlockId, ...patch });
  }
  async completedBlockIds(enrollmentId: string): Promise<string[]> {
    // espelha a regra real: evento answer/complete com detail.correct=true por bloco
    return [...this.completedByEnrollment.get(enrollmentId) ?? []];
  }
  // usado pelo InMemoryEventRepository para simular a junção com learning_events
  completedByEnrollment = new Map<string, Set<string>>();
}

export class InMemoryEventRepository implements EventRepository {
  events: { enrollmentId: string; interactionId: string | null; event: string; detail: unknown }[] = [];
  interactions = new Map<string, InteractionForGrading>();
  constructor(private readonly progress: InMemoryProgressRepository) {}

  seedInteraction(i: InteractionForGrading) {
    this.interactions.set(i.id, i);
  }

  async create(input: {
    enrollmentId: string;
    interactionId: string | null;
    event: 'view' | 'answer' | 'complete';
    detail: unknown;
  }): Promise<{ id: string }> {
    this.events.push(input);
    const correct = (input.detail as { correct?: boolean } | null)?.correct === true;
    if (correct && input.interactionId) {
      const interaction = this.interactions.get(input.interactionId);
      if (interaction?.contentBlockId) {
        const set = this.progress.completedByEnrollment.get(input.enrollmentId) ?? new Set<string>();
        set.add(interaction.contentBlockId);
        this.progress.completedByEnrollment.set(input.enrollmentId, set);
      }
    }
    return { id: randomUUID() };
  }
  async hasAwardedXp(enrollmentId: string, interactionId: string): Promise<boolean> {
    return this.events.some(
      (e) =>
        e.enrollmentId === enrollmentId &&
        e.interactionId === interactionId &&
        (e.event === 'answer' || e.event === 'complete') &&
        (e.detail as { correct?: boolean } | null)?.correct === true,
    );
  }
  async findInteraction(id: string): Promise<InteractionForGrading | null> {
    return this.interactions.get(id) ?? null;
  }
}

export class InMemoryCertificateRepository implements CertificateRepository {
  rows: (CertificateRecord & { enrollmentId: string })[] = [];
  /** Simula o JOIN feito pelo adapter Prisma real em `findByVerifyCode`. */
  constructor(private readonly enrollments: InMemoryEnrollmentRepository) {}

  async findByEnrollment(enrollmentId: string): Promise<CertificateRecord | null> {
    return this.rows.find((r) => r.enrollmentId === enrollmentId) ?? null;
  }
  async findByVerifyCode(code: string) {
    const row = this.rows.find((r) => r.verifyCode === code);
    if (!row) return null;
    const ctx = await this.enrollments.getCertificateContext(row.enrollmentId);
    return { ...row, learnerName: ctx?.learnerName ?? '', projectTitle: ctx?.projectTitle ?? '' };
  }
  async create(input: {
    enrollmentId: string;
    verifyCode: string;
    pdfS3Key: string;
  }): Promise<CertificateRecord> {
    const row = {
      id: randomUUID(),
      enrollmentId: input.enrollmentId,
      verifyCode: input.verifyCode,
      pdfS3Key: input.pdfS3Key,
      issuedAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }
}

export class FakeCertificateStorage implements CertificateStorage {
  saved: { key: string; bytes: Buffer }[] = [];
  async put(key: string, bytes: Buffer): Promise<void> {
    this.saved.push({ key, bytes });
  }
  async presignGet(key: string): Promise<string> {
    return `https://minio.local/${key}?signature=fake`;
  }
}

export class FakeQrCodeGenerator implements QrCodeGenerator {
  async toPngBuffer(): Promise<Buffer> {
    return Buffer.from('fake-png');
  }
}

export class FakeCertificatePdfBuilder implements CertificatePdfBuilder {
  async build(): Promise<Buffer> {
    return Buffer.from('%PDF-fake');
  }
}
