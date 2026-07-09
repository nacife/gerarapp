import { beforeEach, describe, expect, it } from 'vitest';
import type { Manifest } from '@eduforge/schemas';
import { AppError } from '../common/errors';
import { FakeHasher, FixedClock } from '../auth/testing/fakes';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  InMemoryWebhookDeliveryRepository,
  InMemoryWebhookEndpointRepository,
  InMemoryWebhookEnqueuer,
  InMemoryWebhookProjectRepository,
} from '../webhooks/testing/fakes';
import { LearnerAuthService } from './learner-auth.service';
import { EnrollmentService } from './enrollment.service';
import { EventsService } from './events.service';
import { CertificateService } from './certificate.service';
import { JwtLearnerTokenService } from './domain/learner-token';
import {
  FakeCertificatePdfBuilder,
  FakeCertificateStorage,
  FakeQrCodeGenerator,
  InMemoryCertificateRepository,
  InMemoryEnrollmentRepository,
  InMemoryEventRepository,
  InMemoryLearnerRepository,
  InMemoryProgressRepository,
} from './testing/fakes';

const BLOCK_1 = '11111111-1111-1111-1111-111111111111';
const BLOCK_2 = '22222222-2222-2222-2222-222222222222';

const manifest: Manifest = {
  schemaVersion: 1,
  slug: 'bio-demo',
  title: 'Biologia Demo',
  version: 1,
  publishedAt: new Date().toISOString(),
  access: { mode: 'public' },
  theme: {
    template: 'modern',
    tokens: {},
    palette: { light: {}, dark: {} },
    typography: {},
    effects: {},
  },
  content: {
    chapters: [
      {
        id: 'c1',
        title: 'A Célula',
        confidence: 0.9,
        children: [
          { id: 's1', title: 'Membrana', confidence: 0.9, blockId: BLOCK_1 },
          { id: 's2', title: 'Núcleo', confidence: 0.9, blockId: BLOCK_2 },
        ],
      },
    ],
  },
  interactions: [],
};

async function expectError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('esperava AppError');
}

function build() {
  const hasher = new FakeHasher();
  const learners = new InMemoryLearnerRepository();
  const enrollments = new InMemoryEnrollmentRepository();
  const progress = new InMemoryProgressRepository();
  const events = new InMemoryEventRepository(progress);
  const certificatesRepo = new InMemoryCertificateRepository(enrollments);
  const storage = new FakeCertificateStorage();
  const clock = new FixedClock();

  const learnerAuth = new LearnerAuthService(
    learners,
    hasher,
    new JwtLearnerTokenService('test-secret-0123456789-abcdefghij', 3600),
  );
  const webhookEndpoints = new InMemoryWebhookEndpointRepository();
  const webhookDeliveries = new InMemoryWebhookDeliveryRepository();
  const webhookProjects = new InMemoryWebhookProjectRepository();
  const webhooks = new WebhooksService(
    webhookEndpoints,
    webhookDeliveries,
    webhookProjects,
    new InMemoryWebhookEnqueuer(),
    'test-encryption-key-32-chars-ok',
  );
  const enrollmentService = new EnrollmentService(enrollments, progress, certificatesRepo, hasher, webhooks);
  const certificateService = new CertificateService(
    enrollments,
    progress,
    certificatesRepo,
    storage,
    new FakeQrCodeGenerator(),
    new FakeCertificatePdfBuilder(),
    'http://localhost:3000',
    webhooks,
  );
  const eventsService = new EventsService(events, progress, enrollments, certificateService, clock, webhooks);

  return {
    learnerAuth,
    enrollmentService,
    eventsService,
    certificateService,
    learners,
    enrollments,
    progress,
    events,
    certificatesRepo,
    webhookEndpoints,
    webhookDeliveries,
    webhookProjects,
  };
}

async function makeLearner(kit: ReturnType<typeof build>, email = 'ana@ex.com') {
  const session = await kit.learnerAuth.signup({ email, name: 'Ana', password: 'AprendizBoa1' });
  kit.enrollments.registerLearnerName(session.learnerId, 'Ana');
  return session.learnerId;
}

describe('LearnerAuthService — conta leve', () => {
  it('rejeita senha fraca', async () => {
    const kit = build();
    const err = await expectError(() => kit.learnerAuth.signup({ email: 'a@b.com', password: 'curta', name: 'A' }));
    expect(err.slug).toBe('weak-password');
  });

  it('cadastro duplicado com a MESMA senha apenas autentica (conta leve)', async () => {
    const kit = build();
    const first = await kit.learnerAuth.signup({ email: 'a@b.com', password: 'SenhaBoa123', name: 'A' });
    const second = await kit.learnerAuth.signup({ email: 'a@b.com', password: 'SenhaBoa123', name: 'A' });
    expect(second.learnerId).toBe(first.learnerId);
  });

  it('cadastro duplicado com senha DIFERENTE é rejeitado', async () => {
    const kit = build();
    await kit.learnerAuth.signup({ email: 'a@b.com', password: 'SenhaBoa123', name: 'A' });
    const err = await expectError(() =>
      kit.learnerAuth.signup({ email: 'a@b.com', password: 'OutraSenha2', name: 'A' }),
    );
    expect(err.slug).toBe('email-in-use');
  });

  it('login com senha errada falha', async () => {
    const kit = build();
    await kit.learnerAuth.signup({ email: 'a@b.com', password: 'SenhaBoa123', name: 'A' });
    const err = await expectError(() => kit.learnerAuth.login({ email: 'a@b.com', password: 'errada' }));
    expect(err.slug).toBe('invalid-credentials');
  });
});

describe('EnrollmentService.enroll (RF-05)', () => {
  it('app público: matricula com sucesso e devolve o manifesto', async () => {
    const kit = build();
    kit.enrollments.seedProject({ slug: 'bio-demo', title: 'Biologia Demo', manifest });
    const learnerId = await makeLearner(kit);
    const res = await kit.enrollmentService.enroll({ slug: 'bio-demo', learnerId, learnerEmail: 'ana@ex.com' });
    expect(res.manifest.slug).toBe('bio-demo');
  });

  it('app não publicado (sem manifesto) é rejeitado', async () => {
    const kit = build();
    kit.enrollments.seedProject({ slug: 'bio-demo', title: 'Biologia Demo', manifest: null });
    const learnerId = await makeLearner(kit);
    const err = await expectError(() => kit.enrollmentService.enroll({ slug: 'bio-demo', learnerId, learnerEmail: 'ana@ex.com' }));
    expect(err.slug).toBe('app-not-published');
  });

  it('app com senha: sem chave falha, com chave certa funciona', async () => {
    const kit = build();
    kit.enrollments.seedProject({
      slug: 'bio-demo',
      title: 'Biologia Demo',
      accessMode: 'password',
      accessSecret: 'hashed:segredo123',
      manifest,
    });
    const learnerId = await makeLearner(kit);
    const noKey = await expectError(() =>
      kit.enrollmentService.enroll({ slug: 'bio-demo', learnerId, learnerEmail: 'ana@ex.com' }),
    );
    expect(noKey.slug).toBe('app-locked');
    const ok = await kit.enrollmentService.enroll({
      slug: 'bio-demo',
      learnerId,
      learnerEmail: 'ana@ex.com',
      accessKey: 'segredo123',
    });
    expect(ok.enrollmentId).toBeTruthy();
  });

  it('app por convite: e-mail não convidado é barrado; convidado passa', async () => {
    const kit = build();
    const project = kit.enrollments.seedProject({
      slug: 'bio-demo',
      title: 'Biologia Demo',
      accessMode: 'invite',
      manifest,
    });
    const learnerId = await makeLearner(kit);
    const blocked = await expectError(() =>
      kit.enrollmentService.enroll({ slug: 'bio-demo', learnerId, learnerEmail: 'ana@ex.com' }),
    );
    expect(blocked.slug).toBe('not-invited');

    await kit.enrollments.addInvite(project.id, 'ana@ex.com');
    const ok = await kit.enrollmentService.enroll({ slug: 'bio-demo', learnerId, learnerEmail: 'ana@ex.com' });
    expect(ok.enrollmentId).toBeTruthy();
  });

  it('matricular duas vezes retorna a mesma matrícula (idempotente)', async () => {
    const kit = build();
    kit.enrollments.seedProject({ slug: 'bio-demo', title: 'Biologia Demo', manifest });
    const learnerId = await makeLearner(kit);
    const first = await kit.enrollmentService.enroll({ slug: 'bio-demo', learnerId, learnerEmail: 'ana@ex.com' });
    const second = await kit.enrollmentService.enroll({ slug: 'bio-demo', learnerId, learnerEmail: 'ana@ex.com' });
    expect(second.enrollmentId).toBe(first.enrollmentId);
  });

  it('primeira matrícula dispara learner.enrolled; re-matrícula não dispara de novo', async () => {
    const kit = build();
    const project = kit.enrollments.seedProject({ slug: 'bio-demo', title: 'Biologia Demo', manifest });
    kit.webhookProjects.ownedProjectIds.set(project.id, 'owner-1');
    await kit.webhookEndpoints.create({
      ownerUserId: 'owner-1',
      projectId: null,
      url: 'https://example.com/hook',
      events: ['learner.enrolled'],
      secretSealed: { iv: 'x', tag: 'y', data: 'z' },
    });
    const learnerId = await makeLearner(kit);

    await kit.enrollmentService.enroll({ slug: 'bio-demo', learnerId, learnerEmail: 'ana@ex.com' });
    await kit.enrollmentService.enroll({ slug: 'bio-demo', learnerId, learnerEmail: 'ana@ex.com' });

    expect(kit.webhookDeliveries.rows).toHaveLength(1);
    expect(kit.webhookDeliveries.rows[0]?.eventType).toBe('learner.enrolled');
  });
});

describe('EventsService.record — XP, mastery, SM-2, certificado', () => {
  let kit: ReturnType<typeof build>;
  let enrollmentId: string;

  beforeEach(async () => {
    kit = build();
    kit.enrollments.seedProject({ slug: 'bio-demo', title: 'Biologia Demo', manifest });
    const learnerId = await makeLearner(kit);
    const enrolled = await kit.enrollmentService.enroll({ slug: 'bio-demo', learnerId, learnerEmail: 'ana@ex.com' });
    enrollmentId = enrolled.enrollmentId;
    kit.events.seedInteraction({ id: 'int-quiz', projectId: '', contentBlockId: BLOCK_1, type: 'quiz', payload: {}, xp: 10 });
    kit.events.seedInteraction({ id: 'int-cards', projectId: '', contentBlockId: BLOCK_2, type: 'flashcard_deck', payload: {}, xp: 15 });
    // projectId nas interações precisa bater com o do enrollment — corrige após criar:
    const enr = kit.enrollments.enrollments.find((e) => e.id === enrollmentId)!;
    kit.events.interactions.get('int-quiz')!.projectId = enr.projectId;
    kit.events.interactions.get('int-cards')!.projectId = enr.projectId;
  });

  it('resposta correta concede XP uma única vez (retry não duplica)', async () => {
    const r1 = await kit.eventsService.record(enrollmentId, kit.enrollments.enrollments[0].learnerId, {
      event: 'answer',
      interactionId: 'int-quiz',
      detail: { correct: true },
    });
    expect(r1.xpAwarded).toBe(10);
    expect(r1.xpTotal).toBe(10);

    const r2 = await kit.eventsService.record(enrollmentId, kit.enrollments.enrollments[0].learnerId, {
      event: 'answer',
      interactionId: 'int-quiz',
      detail: { correct: true },
    });
    expect(r2.xpAwarded).toBe(0);
    expect(r2.xpTotal).toBe(10);
  });

  it('flashcard com quality roda o SM-2 e agenda nextReviewAt', async () => {
    const learnerId = kit.enrollments.enrollments[0].learnerId;
    await kit.eventsService.record(enrollmentId, learnerId, {
      event: 'answer',
      interactionId: 'int-cards',
      detail: { correct: true, quality: 4 },
    });
    const row = await kit.progress.get(enrollmentId, BLOCK_2);
    expect(row).not.toBeNull();
    expect(row!.repetitions).toBe(1);
    expect(row!.intervalDays).toBe(1);
    expect(row!.nextReviewAt).not.toBeNull();
    expect(row!.mastery).toBeGreaterThan(0);
  });

  it('completar todos os blocos emite o certificado automaticamente', async () => {
    const learnerId = kit.enrollments.enrollments[0].learnerId;
    await kit.eventsService.record(enrollmentId, learnerId, {
      event: 'answer',
      interactionId: 'int-quiz',
      detail: { correct: true },
    });
    const before = await kit.enrollmentService.getProgress(enrollmentId, learnerId);
    expect(before.certificate).toBeNull();
    expect(before.percent).toBe(50);

    const final = await kit.eventsService.record(enrollmentId, learnerId, {
      event: 'answer',
      interactionId: 'int-cards',
      detail: { correct: true, quality: 5 },
    });
    expect(final.certificateIssued).toBe(true);
    expect(final.verifyCode).toBeTruthy();

    const verified = await kit.certificateService.verify(final.verifyCode!);
    expect(verified.projectTitle).toBe('Biologia Demo');

    const after = await kit.enrollmentService.getProgress(enrollmentId, learnerId);
    expect(after.percent).toBe(100);
    expect(after.certificate?.verifyCode).toBe(final.verifyCode);
  });

  it('completar o app dispara learner.completed e certificate.issued', async () => {
    const learnerId = kit.enrollments.enrollments[0].learnerId;
    const projectId = kit.enrollments.enrollments[0].projectId;
    kit.webhookProjects.ownedProjectIds.set(projectId, 'owner-1');
    await kit.webhookEndpoints.create({
      ownerUserId: 'owner-1',
      projectId: null,
      url: 'https://example.com/hook',
      events: ['learner.completed', 'certificate.issued'],
      secretSealed: { iv: 'x', tag: 'y', data: 'z' },
    });

    await kit.eventsService.record(enrollmentId, learnerId, {
      event: 'answer',
      interactionId: 'int-quiz',
      detail: { correct: true },
    });
    await kit.eventsService.record(enrollmentId, learnerId, {
      event: 'answer',
      interactionId: 'int-cards',
      detail: { correct: true, quality: 5 },
    });

    const eventTypes = kit.webhookDeliveries.rows.map((r) => r.eventType).sort();
    expect(eventTypes).toEqual(['certificate.issued', 'learner.completed']);
  });

  it('streak que avança dispara learning.milestone; mesmo dia não dispara de novo', async () => {
    const learnerId = kit.enrollments.enrollments[0].learnerId;
    const projectId = kit.enrollments.enrollments[0].projectId;
    kit.webhookProjects.ownedProjectIds.set(projectId, 'owner-1');
    await kit.webhookEndpoints.create({
      ownerUserId: 'owner-1',
      projectId: null,
      url: 'https://example.com/hook',
      events: ['learning.milestone'],
      secretSealed: { iv: 'x', tag: 'y', data: 'z' },
    });

    await kit.eventsService.record(enrollmentId, learnerId, { event: 'view' });
    expect(kit.webhookDeliveries.rows).toHaveLength(1);
    expect(kit.webhookDeliveries.rows[0]?.eventType).toBe('learning.milestone');

    await kit.eventsService.record(enrollmentId, learnerId, { event: 'view' });
    expect(kit.webhookDeliveries.rows).toHaveLength(1);
  });

  it('não é possível registrar evento em matrícula de outro aprendiz', async () => {
    const err = await expectError(() =>
      kit.eventsService.record(enrollmentId, 'outro-learner-id', { event: 'view' }),
    );
    expect(err.slug).toBe('not-found');
  });

  it('certificado inexistente na verificação retorna not-found', async () => {
    const err = await expectError(() => kit.certificateService.verify('CODIGO-INEXISTENTE'));
    expect(err.slug).toBe('not-found');
  });
});
