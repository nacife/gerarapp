import type { SenseiTone, TutorChunk } from '@eduforge/ai';

export interface SenseiConfig {
  name: string;
  avatar: string;
  tone: SenseiTone;
}

export const DEFAULT_SENSEI_CONFIG: SenseiConfig = { name: 'Sensei', avatar: '🤖', tone: 'formal' };

export interface SenseiProjectRepository {
  /** Projeto do dono (config do criador) — null quando não é dele. */
  getOwnedProject(projectId: string, ownerUserId: string): Promise<{ id: string } | null>;
  getSenseiConfig(projectId: string): Promise<SenseiConfig | null>;
  setSenseiConfig(projectId: string, config: SenseiConfig): Promise<void>;
  /** Resolve a matrícula do aprendiz → projeto + dono; null quando a matrícula não é dele. */
  getProjectForEnrollment(
    enrollmentId: string,
    learnerId: string,
  ): Promise<{ projectId: string; ownerUserId: string } | null>;
  /** Config pública por slug do app publicado (runtime) + se o RAG já foi indexado. */
  getPublicBySlug(slug: string): Promise<{ config: SenseiConfig; indexed: boolean } | null>;
}

export interface SenseiRetrievalRepository {
  /** Top-`limit` blocos do mapa aprovado por similaridade de cosseno (pgvector `<=>`). */
  searchBlocks(projectId: string, vector: number[], limit: number): Promise<TutorChunk[]>;
  /** O projeto tem ao menos um bloco indexado? (distinção "fora de escopo" × "não indexado") */
  hasEmbeddings(projectId: string): Promise<boolean>;
}

export interface SenseiCreditsRepository {
  balance(userId: string): Promise<number>;
  debit(userId: string, amount: number, refId: string): Promise<void>;
}

export interface SenseiEventRepository {
  recordTutorQuestion(enrollmentId: string, detail: unknown): Promise<void>;
}
