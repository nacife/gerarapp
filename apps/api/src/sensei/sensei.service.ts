import type { AiProvider } from '@eduforge/ai';
import { Errors } from '../common/errors';
import {
  DEFAULT_SENSEI_CONFIG,
  type SenseiConfig,
  type SenseiCreditsRepository,
  type SenseiEventRepository,
  type SenseiProjectRepository,
  type SenseiRetrievalRepository,
} from './ports';
import { type AskSenseiDto, type SenseiConfigDto } from './dto/schemas';
import {
  SIMILARITY_THRESHOLD,
  TOP_K,
  enforceCitationGate,
  type GatedAnswer,
  selectContext,
} from './domain/guardrails';

const TUTOR_QUESTION_COST = 1;
const RETRIEVAL_LIMIT = 8;

export interface AskOutput {
  answer: string;
  citations: { blockId: string; sourceRef: unknown }[];
  refused: boolean;
  tutor: { name: string; avatar: string; tone: string };
}

export class SenseiService {
  constructor(
    private readonly projects: SenseiProjectRepository,
    private readonly retrieval: SenseiRetrievalRepository,
    private readonly credits: SenseiCreditsRepository,
    private readonly events: SenseiEventRepository,
    private readonly ai: AiProvider,
  ) {}

  /** Config atual do tutor para um projeto do criador. */
  async getConfig(projectId: string, ownerUserId: string): Promise<SenseiConfig> {
    const project = await this.projects.getOwnedProject(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');

    const config = await this.projects.getSenseiConfig(projectId);
    return config ?? { ...DEFAULT_SENSEI_CONFIG };
  }

  /** Atualiza a config do tutor (dono do projeto). */
  async setConfig(
    projectId: string,
    ownerUserId: string,
    dto: SenseiConfigDto,
  ): Promise<SenseiConfig> {
    const project = await this.projects.getOwnedProject(projectId, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');

    const config: SenseiConfig = { name: dto.name, avatar: dto.avatar, tone: dto.tone };
    await this.projects.setSenseiConfig(projectId, config);
    return config;
  }

  /** Config pública do Sensei para o runtime (slug + flag indexed). */
  async getPublicConfig(slug: string) {
    const info = await this.projects.getPublicBySlug(slug);
    if (!info) throw Errors.notFound('App');
    return info;
  }

  /** Pergunta do aprendiz ao Sensei (RF-06.1). */
  async ask(
    enrollmentId: string,
    learnerId: string,
    dto: AskSenseiDto,
  ): Promise<AskOutput> {
    // a) Resolve matrícula → projeto + dono.
    const enrollment = await this.projects.getProjectForEnrollment(enrollmentId, learnerId);
    if (!enrollment) throw Errors.notFound('Matrícula');

    const { projectId, ownerUserId } = enrollment;

    // b) Saldo do dono.
    const balance = await this.credits.balance(ownerUserId);
    if (balance <= 0) {
      throw Errors.insufficientCredits(balance, TUTOR_QUESTION_COST);
    }

    // c) Verifica indexação.
    const indexed = await this.retrieval.hasEmbeddings(projectId);
    if (!indexed) {
      throw Errors.senseiNotIndexed();
    }

    // d) Embedding + retrieval.
    const [vec] = await this.ai.embedTexts([dto.question]);
    const chunks = await this.retrieval.searchBlocks(projectId, vec!, RETRIEVAL_LIMIT);

    // e) Seleciona contexto + pergunta ao provider + portão de citação.
    const context = selectContext(chunks, TOP_K, SIMILARITY_THRESHOLD);

    // Config do tutor para o tom.
    const config =
      (await this.projects.getSenseiConfig(projectId)) ?? DEFAULT_SENSEI_CONFIG;

    const raw = await this.ai.tutorAnswer({
      question: dto.question,
      mode: dto.mode,
      tone: config.tone,
      tutorName: config.name,
      chunks: context,
    });

    const gated = enforceCitationGate(raw, context, config.tone);

    // f) Grava evento de aprendizagem.
    await this.events.recordTutorQuestion(enrollmentId, {
      question: dto.question,
      mode: dto.mode,
      refused: gated.refused,
      citations: gated.citations,
    });

    // g) Debita crédito do dono (só se NÃO recusou).
    if (!gated.refused) {
      await this.credits.debit(ownerUserId, TUTOR_QUESTION_COST, enrollmentId);
    }

    // h) Resposta.
    return {
      answer: gated.answer,
      citations: gated.citations,
      refused: gated.refused,
      tutor: { name: config.name, avatar: config.avatar, tone: config.tone },
    };
  }
}
