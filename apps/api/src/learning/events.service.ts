import { Errors } from '../common/errors';
import type { Clock } from '../auth/domain/clock';
import type { WebhooksService } from '../webhooks/webhooks.service';
import { toDateIso } from './domain/date';
import { updateMastery } from './domain/mastery';
import { sm2, type Sm2State } from './domain/sm2';
import { computeStreak } from './domain/streak';
import type { CertificateService } from './certificate.service';
import type { EnrollmentRepository, EventRepository, ProgressRepository } from './ports';

export interface RecordEventInput {
  event: 'view' | 'answer' | 'complete';
  interactionId?: string;
  detail?: { correct?: boolean; quality?: number } & Record<string, unknown>;
}

export interface RecordEventResult {
  xpAwarded: number;
  xpTotal: number;
  streakDays: number;
  certificateIssued: boolean;
  verifyCode?: string;
}

export class EventsService {
  constructor(
    private readonly events: EventRepository,
    private readonly progress: ProgressRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly certificates: CertificateService,
    private readonly clock: Clock,
    private readonly webhooks: WebhooksService,
  ) {}

  async record(
    enrollmentId: string,
    learnerId: string,
    input: RecordEventInput,
  ): Promise<RecordEventResult> {
    const enrollment = await this.enrollments.findByIdForLearner(enrollmentId, learnerId);
    if (!enrollment) throw Errors.notFound('Matrícula');

    const interaction = input.interactionId ? await this.events.findInteraction(input.interactionId) : null;
    if (input.interactionId && (!interaction || interaction.projectId !== enrollment.projectId)) {
      throw Errors.notFound('Interação');
    }

    // Verifica ANTES de inserir o evento atual (senão a checagem sempre acharia o próprio evento).
    const alreadyAwarded =
      interaction && input.interactionId ? await this.events.hasAwardedXp(enrollmentId, input.interactionId) : false;

    await this.events.create({
      enrollmentId,
      interactionId: input.interactionId ?? null,
      event: input.event,
      detail: input.detail ?? null,
    });

    let xpAwarded = 0;
    if (interaction && (input.event === 'answer' || input.event === 'complete')) {
      const correct = input.detail?.correct === true;

      if (interaction.contentBlockId) {
        const prevRow = (await this.progress.get(enrollmentId, interaction.contentBlockId)) ?? {
          contentBlockId: interaction.contentBlockId,
          mastery: 0,
          easeFactor: 2.5,
          intervalDays: 0,
          repetitions: 0,
          nextReviewAt: null,
        };
        const mastery = updateMastery(prevRow.mastery, correct);

        let sm2State: Sm2State = {
          easeFactor: prevRow.easeFactor,
          intervalDays: prevRow.intervalDays,
          repetitions: prevRow.repetitions,
        };
        let nextReviewAt = prevRow.nextReviewAt;
        if (interaction.type === 'flashcard_deck' && typeof input.detail?.quality === 'number') {
          const res = sm2(sm2State, input.detail.quality, this.clock.now());
          sm2State = res;
          nextReviewAt = res.nextReviewAt;
        }

        await this.progress.upsert(enrollmentId, interaction.contentBlockId, {
          mastery,
          ...sm2State,
          nextReviewAt,
        });
      }

      if (correct && !alreadyAwarded) xpAwarded = interaction.xp;
    }

    const today = toDateIso(this.clock.now());
    const nextStreak = computeStreak(
      {
        streakDays: enrollment.streakDays,
        lastActivityAt: enrollment.lastActivityAt,
        streakFreezeUsedAt: enrollment.streakFreezeUsedAt,
      },
      today,
    );
    const xpTotal = enrollment.xp + xpAwarded;
    const previousStreakDays = enrollment.streakDays;
    await this.enrollments.updateGamification(enrollmentId, {
      xp: xpAwarded ? xpTotal : undefined,
      streakDays: nextStreak.streakDays !== previousStreakDays ? nextStreak.streakDays : undefined,
      lastActivityAt:
        nextStreak.lastActivityAt !== enrollment.lastActivityAt ? (nextStreak.lastActivityAt ?? undefined) : undefined,
      streakFreezeUsedAt:
        nextStreak.streakFreezeUsedAt !== enrollment.streakFreezeUsedAt ? nextStreak.streakFreezeUsedAt : undefined,
    });

    if (nextStreak.streakDays > previousStreakDays) {
      await this.webhooks.dispatchForProject(enrollment.projectId, 'learning.milestone', {
        enrollmentId,
        kind: 'streak',
        streakDays: nextStreak.streakDays,
      });
    }

    const certificate = await this.certificates.checkAndIssue(enrollmentId);

    return {
      xpAwarded,
      xpTotal,
      streakDays: nextStreak.streakDays,
      certificateIssued: !!certificate,
      verifyCode: certificate?.verifyCode,
    };
  }
}
