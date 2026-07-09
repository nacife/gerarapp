import type { ContentMapTree, MapNode } from '@eduforge/schemas';

export interface AnnotatedNode {
  id: string;
  title: string;
  blockId?: string;
  done?: boolean;
  children?: AnnotatedNode[];
}

/** Anota a árvore do mapa com o estado de conclusão de cada bloco (RF-05). */
export function annotateChapters(tree: ContentMapTree, doneBlockIds: Set<string>): AnnotatedNode[] {
  const walk = (nodes: MapNode[]): AnnotatedNode[] =>
    nodes.map((n) => ({
      id: n.id,
      title: n.title,
      blockId: n.blockId,
      done: n.blockId ? doneBlockIds.has(n.blockId) : undefined,
      children: n.children ? walk(n.children) : undefined,
    }));
  return walk(tree.chapters);
}
