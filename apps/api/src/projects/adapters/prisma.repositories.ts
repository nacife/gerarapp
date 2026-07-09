import { Prisma, prisma } from '@eduforge/db';
import type { ContentMapTree } from '@eduforge/schemas';
import type { SourceMimeKey } from '../domain/source-file';
import type {
  ContentMapRecord,
  ContentMapRepository,
  JobProgress,
  JobRecord,
  JobRepository,
  ProjectRecord,
  ProjectRepository,
  SourceFileRecord,
  SourceFileRepository,
} from '../ports';

function mapProject(p: {
  id: string;
  ownerUserId: string;
  orgId: string | null;
  title: string;
  slug: string;
  status: string;
  accessMode: string;
  createdAt: Date;
}): ProjectRecord {
  return {
    id: p.id,
    ownerUserId: p.ownerUserId,
    orgId: p.orgId,
    title: p.title,
    slug: p.slug,
    status: p.status,
    accessMode: p.accessMode,
    createdAt: p.createdAt,
  };
}

export class PrismaProjectRepository implements ProjectRepository {
  async create(input: { ownerUserId: string; title: string; slug: string }): Promise<ProjectRecord> {
    const p = await prisma.project.create({ data: input });
    return mapProject(p);
  }
  async listByOwner(ownerUserId: string): Promise<ProjectRecord[]> {
    const rows = await prisma.project.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapProject);
  }
  async findByIdForOwner(id: string, ownerUserId: string): Promise<ProjectRecord | null> {
    const p = await prisma.project.findFirst({ where: { id, ownerUserId } });
    return p ? mapProject(p) : null;
  }
  async slugExists(slug: string): Promise<boolean> {
    return (await prisma.project.count({ where: { slug } })) > 0;
  }
}

function mapSourceFile(sf: {
  id: string;
  projectId: string;
  s3Key: string;
  mime: string;
  sizeBytes: bigint;
  sha256: string;
  ocrStatus: string;
}): SourceFileRecord {
  return {
    id: sf.id,
    projectId: sf.projectId,
    s3Key: sf.s3Key,
    mime: sf.mime as SourceMimeKey,
    sizeBytes: Number(sf.sizeBytes),
    sha256: sf.sha256,
    ocrStatus: sf.ocrStatus,
  };
}

export class PrismaSourceFileRepository implements SourceFileRepository {
  async create(input: {
    projectId: string;
    s3Key: string;
    mime: SourceMimeKey;
    sizeBytes: number;
    sha256: string;
  }): Promise<SourceFileRecord> {
    const sf = await prisma.sourceFile.create({
      data: {
        projectId: input.projectId,
        s3Key: input.s3Key,
        mime: input.mime,
        sizeBytes: BigInt(input.sizeBytes),
        sha256: input.sha256,
      },
    });
    return mapSourceFile(sf);
  }
  async findByIdWithOwner(
    id: string,
  ): Promise<(SourceFileRecord & { ownerUserId: string }) | null> {
    const sf = await prisma.sourceFile.findUnique({
      where: { id },
      include: { project: { select: { ownerUserId: true } } },
    });
    if (!sf) return null;
    return { ...mapSourceFile(sf), ownerUserId: sf.project.ownerUserId };
  }
}

function mapJob(j: {
  id: string;
  type: string;
  status: string;
  projectId: string | null;
  refId: string | null;
  progress: Prisma.JsonValue;
  error: string | null;
}): JobRecord {
  return {
    id: j.id,
    type: j.type,
    status: j.status,
    projectId: j.projectId,
    refId: j.refId,
    progress: (j.progress as unknown as JobProgress | null) ?? null,
    error: j.error,
  };
}

export class PrismaJobRepository implements JobRepository {
  async create(input: {
    type: 'ingest' | 'generate';
    projectId: string;
    refId?: string;
    progress: JobProgress;
  }): Promise<JobRecord> {
    const j = await prisma.job.create({
      data: {
        type: input.type,
        projectId: input.projectId,
        refId: input.refId,
        status: 'queued',
        progress: input.progress as unknown as Prisma.InputJsonValue,
      },
    });
    return mapJob(j);
  }
  async findByIdWithOwner(
    id: string,
  ): Promise<(JobRecord & { ownerUserId: string | null }) | null> {
    const j = await prisma.job.findUnique({
      where: { id },
      include: { project: { select: { ownerUserId: true } } },
    });
    if (!j) return null;
    return { ...mapJob(j), ownerUserId: j.project?.ownerUserId ?? null };
  }
}

function mapContentMap(m: {
  id: string;
  projectId: string;
  revision: number;
  tree: Prisma.JsonValue;
  structureConfidence: number | null;
  approvedAt: Date | null;
}): ContentMapRecord {
  return {
    id: m.id,
    projectId: m.projectId,
    revision: m.revision,
    tree: m.tree as unknown as ContentMapTree,
    structureConfidence: m.structureConfidence,
    approvedAt: m.approvedAt,
  };
}

export class PrismaContentMapRepository implements ContentMapRepository {
  async latestForProject(projectId: string): Promise<ContentMapRecord | null> {
    const m = await prisma.contentMap.findFirst({
      where: { projectId },
      orderBy: { revision: 'desc' },
    });
    return m ? mapContentMap(m) : null;
  }
  async createRevision(input: {
    projectId: string;
    tree: ContentMapTree;
    structureConfidence: number | null;
  }): Promise<ContentMapRecord> {
    const last = await prisma.contentMap.findFirst({
      where: { projectId: input.projectId },
      orderBy: { revision: 'desc' },
      select: { revision: true },
    });
    const m = await prisma.contentMap.create({
      data: {
        projectId: input.projectId,
        revision: (last?.revision ?? 0) + 1,
        tree: input.tree as unknown as Prisma.InputJsonValue,
        structureConfidence: input.structureConfidence,
      },
    });
    return mapContentMap(m);
  }
  async approveLatest(projectId: string, at: Date): Promise<ContentMapRecord | null> {
    const last = await prisma.contentMap.findFirst({
      where: { projectId },
      orderBy: { revision: 'desc' },
    });
    if (!last) return null;
    const updated = await prisma.contentMap.update({
      where: { id: last.id },
      data: { approvedAt: at },
    });
    return mapContentMap(updated);
  }
}
