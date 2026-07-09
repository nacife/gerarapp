import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getEnv } from '@eduforge/config';
import { Prisma, prisma } from '@eduforge/db';
import type { BuiltBlock } from './build-map';
import type {
  IngestRepository,
  IngestSourceFile,
  IngestStorage,
  JobProgress,
} from './pipeline';
import type { ContentMapTree } from '@eduforge/schemas';

export class S3IngestStorage implements IngestStorage {
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
    this.bucket = env.S3_BUCKET_UPLOADS;
  }

  async download(s3Key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }));
    if (!res.Body) throw new Error(`objeto vazio: ${s3Key}`);
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
}

export class PrismaIngestRepository implements IngestRepository {
  async getSourceFile(id: string): Promise<IngestSourceFile | null> {
    const sf = await prisma.sourceFile.findUnique({
      where: { id },
      select: { id: true, projectId: true, s3Key: true, mime: true },
    });
    return sf ? { id: sf.id, projectId: sf.projectId, s3Key: sf.s3Key, mime: sf.mime } : null;
  }

  async saveJob(
    jobId: string,
    patch: { status?: 'running' | 'succeeded' | 'failed'; progress?: JobProgress; error?: string },
  ): Promise<void> {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: patch.status,
        progress: patch.progress
          ? (patch.progress as unknown as Prisma.InputJsonValue)
          : undefined,
        error: patch.error,
      },
    });
  }

  async updateSourceFile(
    id: string,
    patch: { ocrStatus?: string; sha256?: string; extractionReport?: unknown },
  ): Promise<void> {
    const data: Record<string, unknown> = {};
    if (patch.ocrStatus) data.ocrStatus = patch.ocrStatus;
    if (patch.sha256) data.sha256 = patch.sha256;
    if (patch.extractionReport !== undefined) data.extractionReport = patch.extractionReport;
    await prisma.sourceFile.update({ where: { id }, data: data as Prisma.SourceFileUpdateInput });
  }

  async saveContentMap(input: {
    projectId: string;
    tree: ContentMapTree;
    structureConfidence: number;
    blocks: BuiltBlock[];
  }): Promise<{ contentMapId: string }> {
    const last = await prisma.contentMap.findFirst({
      where: { projectId: input.projectId },
      orderBy: { revision: 'desc' },
      select: { revision: true },
    });
    const map = await prisma.contentMap.create({
      data: {
        projectId: input.projectId,
        revision: (last?.revision ?? 0) + 1,
        tree: input.tree as unknown as Prisma.InputJsonValue,
        structureConfidence: input.structureConfidence,
      },
    });
    if (input.blocks.length > 0) {
      await prisma.contentBlock.createMany({
        data: input.blocks.map((b, i) => ({
          id: b.id,
          contentMapId: map.id,
          position: i,
          kind: b.kind,
          contentMd: b.contentMd,
          confidence: b.confidence,
          sourceRef: b.sourceRef as unknown as Prisma.InputJsonValue,
        })),
      });
    }
    return { contentMapId: map.id };
  }
}
