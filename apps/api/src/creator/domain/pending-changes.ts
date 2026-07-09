/**
 * "Atualização pendente" (RF-08): o projeto está publicado, mas há mudanças
 * (mapa, interações ou tema) feitas depois da última publicação.
 */
export function hasPendingChanges(input: {
  publishedAt: Date | null;
  latestContentMapCreatedAt: Date | null;
  latestInteractionUpdatedAt: Date | null;
  latestThemeCreatedAt: Date | null;
}): boolean {
  if (!input.publishedAt) return false;
  const publishedAt = input.publishedAt;
  const after = (d: Date | null) => !!d && d.getTime() > publishedAt.getTime();
  return (
    after(input.latestContentMapCreatedAt) ||
    after(input.latestInteractionUpdatedAt) ||
    after(input.latestThemeCreatedAt)
  );
}

export type ProjectDisplayStatus = 'draft' | 'published' | 'pending_update';

export function displayStatus(status: string, pending: boolean): ProjectDisplayStatus {
  if (status !== 'published') return 'draft';
  return pending ? 'pending_update' : 'published';
}
