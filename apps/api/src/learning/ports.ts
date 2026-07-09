import type { Manifest } from '@eduforge/schemas';

export interface LearnerRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
}

export interface LearnerRepository {
  findByEmail(email: string): Promise<LearnerRecord | null>;
  findById(id: string): Promise<LearnerRecord | null>;
  create(input: { email: string; name: string; passwordHash: string }): Promise<LearnerRecord>;
}

export interface EnrollmentRecord {
  id: string;
  learnerId: string;
  projectId: string;
  xp: number;
  streakDays: number;
  lastActivityAt: string | null; // YYYY-MM-DD
  streakFreezeUsedAt: string | null;
}

export interface PublicProjectInfo {
  id: string;
  slug: string;
  title: string;
  accessMode: string;
  accessSecret: string | null;
  manifest: Manifest | null; // null = ainda não publicado
}

export interface EnrolledLearnerRow {
  enrollmentId: string;
  learnerName: string;
  learnerEmail: string;
  xp: number;
  streakDays: number;
  enrolledAt: Date;
  certificateIssued: boolean;
}

export interface EnrollmentRepository {
  findPublicProjectBySlug(slug: string): Promise<PublicProjectInfo | null>;
  isInvited(projectId: string, email: string): Promise<boolean>;
  findByLearnerAndProject(learnerId: string, projectId: string): Promise<EnrollmentRecord | null>;
  create(input: {
    learnerId: string;
    projectId: string;
    pinnedVersionId: string | null;
  }): Promise<EnrollmentRecord>;
  findByIdForLearner(id: string, learnerId: string): Promise<EnrollmentRecord | null>;
  findById(id: string): Promise<EnrollmentRecord | null>;
  getCertificateContext(
    enrollmentId: string,
  ): Promise<{ learnerName: string; projectTitle: string } | null>;
  updateGamification(
    id: string,
    patch: { xp?: number; streakDays?: number; lastActivityAt?: string; streakFreezeUsedAt?: string | null },
  ): Promise<void>;
  getActiveManifest(projectId: string): Promise<Manifest | null>;
  listForProject(
    projectId: string,
  ): Promise<EnrolledLearnerRow[]>;
  addInvite(projectId: string, email: string): Promise<void>;
  /** Top 10 matrículas por XP de um app publicado (slug). */
  getLeaderboard(slug: string): Promise<{ enrollmentId: string; learnerName: string; xp: number }[]>;
}

export interface ProgressRow {
  contentBlockId: string;
  mastery: number;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date | null;
}

export interface ProgressRepository {
  get(enrollmentId: string, contentBlockId: string): Promise<ProgressRow | null>;
  upsert(
    enrollmentId: string,
    contentBlockId: string,
    patch: Omit<ProgressRow, 'contentBlockId'>,
  ): Promise<void>;
  /** Blocos com ao menos um evento correto/completo registrado (para % de conclusão). */
  completedBlockIds(enrollmentId: string): Promise<string[]>;
}

export interface InteractionForGrading {
  id: string;
  projectId: string;
  contentBlockId: string | null;
  type: string;
  payload: unknown;
  xp: number;
}

export interface EventRepository {
  create(input: {
    enrollmentId: string;
    interactionId: string | null;
    event: 'view' | 'answer' | 'complete';
    detail: unknown;
  }): Promise<{ id: string }>;
  hasAwardedXp(enrollmentId: string, interactionId: string): Promise<boolean>;
  findInteraction(id: string): Promise<InteractionForGrading | null>;
}

export interface CertificateRecord {
  id: string;
  verifyCode: string;
  pdfS3Key: string | null;
  issuedAt: Date;
}

export interface CertificateRepository {
  findByEnrollment(enrollmentId: string): Promise<CertificateRecord | null>;
  findByVerifyCode(
    code: string,
  ): Promise<(CertificateRecord & { learnerName: string; projectTitle: string }) | null>;
  create(input: {
    enrollmentId: string;
    verifyCode: string;
    pdfS3Key: string;
  }): Promise<CertificateRecord>;
}

export interface CertificateStorage {
  put(key: string, bytes: Buffer): Promise<void>;
  presignGet(key: string): Promise<string>;
}

export interface QrCodeGenerator {
  toPngBuffer(text: string): Promise<Buffer>;
}

export interface CertificatePdfBuilder {
  build(input: {
    learnerName: string;
    projectTitle: string;
    issuedAt: Date;
    verifyCode: string;
    verifyUrl: string;
    qrPng: Buffer;
  }): Promise<Buffer>;
}
