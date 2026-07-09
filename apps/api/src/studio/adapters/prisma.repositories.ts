import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getEnv } from '@eduforge/config';
import { Prisma, prisma } from '@eduforge/db';
import type { ContentMapTree } from '@eduforge/schemas';
import type { ManifestInteraction, ThemeData } from '../domain/manifest';
import type {
  CatalogRepository,
  ManifestStorage,
  StudioProject,
  StudioRepository,
  VersionSummary,
} from '../ports';

type Access = StudioProject['accessMode'];

export class PrismaStudioRepository implements StudioRepository {
  async getOwnedProject(id: string, ownerUserId: string): Promise<StudioProject | null> {
    const p = await prisma.project.findFirst({
      where: { id, ownerUserId },
      select: { id: true, slug: true, title: true, accessMode: true, accessSecret: true },
    });
    return p
      ? {
          id: p.id,
          slug: p.slug,
          title: p.title,
          accessMode: p.accessMode as Access,
          accessSecret: p.accessSecret,
        }
      : null;
  }

  async getApprovedTree(projectId: string): Promise<ContentMapTree | null> {
    const map = await prisma.contentMap.findFirst({
      where: { projectId, approvedAt: { not: null } },
      orderBy: { revision: 'desc' },
      select: { tree: true },
    });
    return map ? (map.tree as unknown as ContentMapTree) : null;
  }

  async getTheme(projectId: string): Promise<ThemeData | null> {
    const theme = await prisma.theme.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { template: { select: { key: true } } },
    });
    if (!theme) return null;
    return {
      templateKey: theme.template.key,
      palette: theme.palette as unknown as ThemeData['palette'],
      typography: theme.typography as unknown as Record<string, unknown>,
      effects: theme.effects as unknown as Record<string, unknown>,
    };
  }

  async upsertTheme(projectId: string, theme: ThemeData): Promise<void> {
    const template = await prisma.template.findUnique({ where: { key: theme.templateKey } });
    if (!template) throw new Error(`template inexistente: ${theme.templateKey}`);
    const data = {
      templateId: template.id,
      palette: theme.palette as unknown as Prisma.InputJsonValue,
      typography: theme.typography as unknown as Prisma.InputJsonValue,
      effects: theme.effects as unknown as Prisma.InputJsonValue,
    };
    const existing = await prisma.theme.findFirst({ where: { projectId }, select: { id: true } });
    if (existing) await prisma.theme.update({ where: { id: existing.id }, data });
    else await prisma.theme.create({ data: { projectId, ...data } });
  }

  async getDraftInteractions(projectId: string): Promise<ManifestInteraction[]> {
    const rows = await prisma.interaction.findMany({
      where: { projectId, appVersionId: null },
      orderBy: [{ contentBlockId: 'asc' }, { position: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      contentBlockId: r.contentBlockId,
      type: r.type,
      payload: r.payload,
      difficulty: r.difficulty,
      position: r.position,
    }));
  }

  async nextVersion(projectId: string): Promise<number> {
    const last = await prisma.appVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return (last?.versionNumber ?? 0) + 1;
  }

  async createAppVersion(input: {
    projectId: string;
    versionNumber: number;
    manifest: unknown;
    manifestS3Key: string;
    bundleSha512: string;
  }): Promise<{ id: string; versionNumber: number }> {
    const v = await prisma.appVersion.create({
      data: {
        projectId: input.projectId,
        versionNumber: input.versionNumber,
        manifest: input.manifest as Prisma.InputJsonValue,
        manifestS3Key: input.manifestS3Key,
        bundleSha512: input.bundleSha512,
        status: 'published',
        publishedAt: new Date(),
      },
    });
    return { id: v.id, versionNumber: v.versionNumber };
  }

  async setActiveAndPublished(projectId: string, appVersionId: string): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: { activeAppVersionId: appVersionId, status: 'published' },
    });
  }

  async setActive(projectId: string, appVersionId: string): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: { activeAppVersionId: appVersionId },
    });
  }

  async listVersions(projectId: string): Promise<VersionSummary[]> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { activeAppVersionId: true },
    });
    const rows = await prisma.appVersion.findMany({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, bundleSha512: true, publishedAt: true },
    });
    return rows.map((r) => ({ ...r, active: r.id === project?.activeAppVersionId }));
  }

  async findPublishedVersion(
    projectId: string,
    versionNumber: number,
  ): Promise<{ id: string } | null> {
    return prisma.appVersion.findFirst({
      where: { projectId, versionNumber, status: 'published' },
      select: { id: true },
    });
  }

  async setAccess(projectId: string, mode: string, accessSecret: string | null): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: { accessMode: mode as Access, accessSecret },
    });
  }

  async getActiveManifestBySlug(
    slug: string,
  ): Promise<{ manifest: unknown; accessMode: string; accessSecret: string | null } | null> {
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        accessMode: true,
        accessSecret: true,
        activeAppVersion: { select: { manifest: true } },
      },
    });
    if (!project || !project.activeAppVersion) return null;
    return {
      manifest: project.activeAppVersion.manifest,
      accessMode: project.accessMode,
      accessSecret: project.accessSecret,
    };
  }
}

export class PrismaCatalogRepository implements CatalogRepository {
  listTemplates() {
    return prisma.template.findMany({
      where: { published: true },
      select: { id: true, key: true, name: true, tokens: true, minPlanTier: true },
      orderBy: { name: 'asc' },
    });
  }
  listPalettes() {
    return prisma.palette.findMany({
      where: { published: true },
      select: { id: true, key: true, name: true, colors: true, minPlanTier: true },
      orderBy: { name: 'asc' },
    });
  }
}

export class S3ManifestStorage implements ManifestStorage {
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
  async put(key: string, json: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: json,
        ContentType: 'application/json',
      }),
    );
  }
}
