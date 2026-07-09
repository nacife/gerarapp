export interface MediaAssetRow {
  id: string;
  kind: string;
  meta: unknown;
  s3Key: string;
  createdAt: Date;
}

export interface MediaRepository {
  listByProject(projectId: string): Promise<MediaAssetRow[]>;
  listByPublishedSlug(slug: string): Promise<MediaAssetRow[]>;
  getOwnedProject(projectId: string, ownerUserId: string): Promise<{ id: string; title: string } | null>;
  getChapter(projectId: string, chapterId: string): Promise<{ id: string; contentMd: string } | null>;
  createJob(projectId: string, chapterId: string): Promise<string>;
  isPublished(slug: string): Promise<boolean>;
  /** Paleta do tema atual do projeto (cores claras para ilustração). */
  getThemePalette(projectId: string): Promise<Record<string, string> | null>;
  /** Upsert de media_asset — sobrescreve ilustração existente para o mesmo capítulo. */
  upsertMediaAsset(input: {
    projectId: string;
    s3Key: string;
    kind: string;
    meta: unknown;
  }): Promise<{ id: string }>;
  /** Busca media_asset existente para o capítulo (kind=ai_generated). */
  findIllustration(projectId: string, chapterId: string): Promise<{ s3Key: string } | null>;
}

export interface MediaStorage {
  presignGet(key: string): Promise<string>;
  /** Upload de bytes para S3 (ilustração SVG). */
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
}

export interface MediaCreditsRepository {
  balance(userId: string): Promise<number>;
  debit(userId: string, amount: number, reason: string, refId: string): Promise<void>;
}

export interface MediaJobEnqueuer {
  enqueueTts(data: {
    jobId: string;
    projectId: string;
    chapterId: string;
    appTitle: string;
  }): Promise<void>;
}
