import type { AnswerEvent, ChapterBlocks } from './domain/analytics';

export interface ThemeColors {
  primary: string;
  accent: string;
}

export interface HomeProjectRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  accessMode: string;
  createdAt: Date;
  publishedAt: Date | null;
  themeColors: ThemeColors | null;
  pendingChanges: boolean;
  sessionsThisWeek: number;
  certificatesThisWeek: number;
  interactionCount: number;
}

export interface PlanUsage {
  planKey: string;
  limits: { apps: number; uploadMb: number; aiCreditsMonthly: number; customDomains: number };
  usage: { apps: number; storageBytes: number; aiCreditsBalance: number };
}

export interface HomeRepository {
  listProjectsForOwner(ownerId: string): Promise<HomeProjectRow[]>;
  getPlanUsage(ownerId: string): Promise<PlanUsage>;
}

export interface AnalyticsRawData {
  chapters: ChapterBlocks[];
  enrollmentIds: string[];
  doneBlocksByEnrollment: Map<string, Set<string>>;
  touchedBlocksByEnrollment: Map<string, Set<string>>;
  answerEvents: AnswerEvent[];
  sessions: number;
  activeUsers: number;
}

export interface AnalyticsRepository {
  /** null se o projeto não tiver versão publicada ainda. */
  getRawData(projectId: string, from: Date, to: Date): Promise<AnalyticsRawData | null>;
}
