import type { RuntimeTheme } from '../interactions/theme';

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3333';

export interface ManifestNode {
  id: string;
  title: string;
  confidence: number;
  kind?: string;
  blockId?: string;
  excerpt?: string;
  children?: ManifestNode[];
}

export interface Manifest {
  slug: string;
  title: string;
  version: number;
  theme: {
    template: string;
    palette: { light: RuntimeTheme; dark: RuntimeTheme };
    typography: Record<string, unknown>;
  };
  content: { chapters: ManifestNode[] };
  interactions: {
    id: string;
    contentBlockId: string | null;
    type: string;
    payload: unknown;
    difficulty: string;
  }[];
}

export type ManifestResult =
  | { state: 'ok'; manifest: Manifest }
  | { state: 'locked' }
  | { state: 'notfound' }
  | { state: 'error' };

export async function fetchManifest(slug: string, key?: string): Promise<ManifestResult> {
  try {
    const q = key ? `?key=${encodeURIComponent(key)}` : '';
    const res = await fetch(`${API}/v1/public/apps/${encodeURIComponent(slug)}${q}`);
    if (res.status === 401) return { state: 'locked' };
    if (res.status === 404) return { state: 'notfound' };
    if (!res.ok) return { state: 'error' };
    return { state: 'ok', manifest: (await res.json()) as Manifest };
  } catch {
    return { state: 'error' };
  }
}
