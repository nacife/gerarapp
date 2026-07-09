import type { ContentMapTree, MapNode } from '@eduforge/schemas';
import { Errors } from '../common/errors';
import type { ContentMapRecord, ContentMapRepository, ProjectRepository } from './ports';

function collectConfidences(nodes: MapNode[], acc: number[] = []): number[] {
  for (const node of nodes) {
    acc.push(node.confidence);
    if (node.children) collectConfidences(node.children, acc);
  }
  return acc;
}

export function averageConfidence(tree: ContentMapTree): number | null {
  const all = collectConfidences(tree.chapters);
  if (all.length === 0) return null;
  return Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100) / 100;
}

export class ContentMapService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly maps: ContentMapRepository,
  ) {}

  private async assertOwner(projectId: string, ownerUserId: string): Promise<void> {
    if (!(await this.projects.findByIdForOwner(projectId, ownerUserId))) {
      throw Errors.notFound('Projeto');
    }
  }

  async get(projectId: string, ownerUserId: string): Promise<ContentMapRecord> {
    await this.assertOwner(projectId, ownerUserId);
    const map = await this.maps.latestForProject(projectId);
    if (!map) throw Errors.notFound('Mapa de Conteúdo');
    return map;
  }

  /** Salva uma nova revisão com a árvore editada (US-ING-02). */
  async update(projectId: string, ownerUserId: string, tree: ContentMapTree): Promise<ContentMapRecord> {
    await this.assertOwner(projectId, ownerUserId);
    return this.maps.createRevision({
      projectId,
      tree,
      structureConfidence: averageConfidence(tree),
    });
  }

  async approve(projectId: string, ownerUserId: string): Promise<ContentMapRecord> {
    await this.assertOwner(projectId, ownerUserId);
    const approved = await this.maps.approveLatest(projectId, new Date());
    if (!approved) throw Errors.notFound('Mapa de Conteúdo');
    return approved;
  }
}
