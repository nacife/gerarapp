import { Prisma, prisma } from '@eduforge/db';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getEnv } from '@eduforge/config';
import type { PodcastRepository, PodcastStorage } from './pipeline';

/** Extrai o título da primeira linha de um bloco markdown (ex.: "# Título" → "Título"). */
function extractTitle(contentMd: string, fallback: string): string {
  const match = /^#{1,3}\s+(.+)$/m.exec(contentMd);
  return match ? match[1].trim() : fallback;
}

export class PrismaPodcastRepository implements PodcastRepository {
  async getChapterSections(
    projectId: string,
    chapterId: string,
  ): Promise<{ title: string; contentMd: string }[]> {
    const map = await prisma.contentMap.findFirst({
      where: { projectId, approvedAt: { not: null } },
      orderBy: { revision: 'desc' },
      select: { id: true },
    });
    if (!map) return [];

    // Aceita qualquer bloco (capítulo raiz OU seção).
    const block = await prisma.contentBlock.findFirst({
      where: { id: chapterId, contentMapId: map.id },
      select: { id: true, contentMd: true, parentId: true },
    });
    if (!block) return [];

    const sections = await prisma.contentBlock.findMany({
      where: { parentId: chapterId },
      orderBy: { position: 'asc' },
      select: { contentMd: true },
    });

    // Se o bloco tem filhos → é um capítulo → usa suas seções.
    if (sections.length > 0) {
      return sections.map((s, i) => ({
        title: extractTitle(s.contentMd, `Seção ${i + 1}`),
        contentMd: s.contentMd,
      }));
    }

    // Bloco sem filhos → usa o próprio bloco como única seção.
    return [{ title: extractTitle(block.contentMd, 'Capítulo'), contentMd: block.contentMd }];
  }

  async createMediaAsset(input: {
    projectId: string;
    s3Key: string;
    kind: string;
    meta: unknown;
  }): Promise<{ id: string }> {
    return prisma.mediaAsset.create({
      data: {
        projectId: input.projectId,
        s3Key: input.s3Key,
        kind: 'tts',
        meta: input.meta as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  }

  async saveJob(
    jobId: string,
    patch: { status: 'completed' | 'failed'; error?: string },
  ): Promise<void> {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: patch.status === 'completed' ? 'succeeded' : 'failed',
        error: patch.error ?? null,
      },
    });
  }
}

/** Storage para mídia gerada (podcasts, ilustrações) no bucket de apps. */
export class S3MediaStorage implements PodcastStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const env = getEnv();
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    });
    this.bucket = env.S3_BUCKET_APPS;
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType }),
    );
  }
}
