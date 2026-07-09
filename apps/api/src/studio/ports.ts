import type { ContentMapTree } from '@eduforge/schemas';
import type { ManifestInteraction, ThemeData } from './domain/manifest';

export interface StudioProject {
  id: string;
  slug: string;
  title: string;
  accessMode: 'public' | 'link' | 'password' | 'invite';
  accessSecret: string | null;
}

export interface VersionSummary {
  id: string;
  versionNumber: number;
  bundleSha512: string | null;
  publishedAt: Date | null;
  active: boolean;
}

export interface StudioRepository {
  getOwnedProject(id: string, ownerUserId: string): Promise<StudioProject | null>;
  getApprovedTree(projectId: string): Promise<ContentMapTree | null>;
  getTheme(projectId: string): Promise<ThemeData | null>;
  upsertTheme(projectId: string, theme: ThemeData): Promise<void>;
  getDraftInteractions(projectId: string): Promise<ManifestInteraction[]>;
  nextVersion(projectId: string): Promise<number>;
  createAppVersion(input: {
    projectId: string;
    versionNumber: number;
    manifest: unknown;
    manifestS3Key: string;
    bundleSha512: string;
  }): Promise<{ id: string; versionNumber: number }>;
  setActiveAndPublished(projectId: string, appVersionId: string): Promise<void>;
  setActive(projectId: string, appVersionId: string): Promise<void>;
  listVersions(projectId: string): Promise<VersionSummary[]>;
  findPublishedVersion(projectId: string, versionNumber: number): Promise<{ id: string } | null>;
  setAccess(projectId: string, mode: string, accessSecret: string | null): Promise<void>;
  getActiveManifestBySlug(
    slug: string,
  ): Promise<{ manifest: unknown; accessMode: string; accessSecret: string | null } | null>;
}

export interface ManifestStorage {
  put(key: string, json: string): Promise<void>;
}

export interface CatalogRepository {
  listTemplates(): Promise<
    { id: string; key: string; name: string; tokens: unknown; minPlanTier: number }[]
  >;
  listPalettes(): Promise<
    { id: string; key: string; name: string; colors: unknown; minPlanTier: number }[]
  >;
}

export interface SecretHasher {
  hash(secret: string): Promise<string>;
  verify(hashed: string, secret: string): Promise<boolean>;
}

/** Enfileira a indexação do RAG do Sensei após o publish (fila sensei-embed, M10). */
export interface SenseiEmbedEnqueuer {
  enqueueEmbed(projectId: string): Promise<void>;
}
