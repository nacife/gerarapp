import type { ContentMapTree, Manifest } from '@eduforge/schemas';
import { TEMPLATE_TOKENS } from '@eduforge/ui';

export interface ManifestInteraction {
  id: string;
  contentBlockId: string | null;
  type: string;
  payload: unknown;
  difficulty: string;
  position: number;
}

export interface ThemeData {
  templateKey: string;
  palette: { light: Record<string, string>; dark: Record<string, string> };
  typography: Record<string, unknown>;
  effects: Record<string, unknown>;
}

/** Tema padrão quando o projeto ainda não configurou o Estúdio. */
export const DEFAULT_THEME: ThemeData = {
  templateKey: 'modern',
  palette: {
    light: {
      bg: '#ffffff',
      surface: '#f4f6f8',
      text: '#0f172a',
      muted: '#5b6472',
      border: '#e2e8f0',
      primary: '#0ea5e9',
      secondary: '#0369a1',
      accent: '#22d3ee',
    },
    dark: {
      bg: '#0b1120',
      surface: '#141b2d',
      text: '#f8fafc',
      muted: '#94a3b8',
      border: '#1f2937',
      primary: '#0ea5e9',
      secondary: '#0369a1',
      accent: '#22d3ee',
    },
  },
  typography: { heading: 'Inter', body: 'Inter', scale: 1.25 },
  effects: { confetti: true, flip3d: true, parallax: false },
};

/** Monta o manifesto imutável do app publicado (RF-04). */
export function buildManifest(input: {
  slug: string;
  title: string;
  version: number;
  publishedAt: string;
  accessMode: 'public' | 'link' | 'password' | 'invite';
  theme: ThemeData;
  content: ContentMapTree;
  interactions: ManifestInteraction[];
}): Manifest {
  const tokens = TEMPLATE_TOKENS[input.theme.templateKey] ?? TEMPLATE_TOKENS.modern;
  return {
    schemaVersion: 1,
    slug: input.slug,
    title: input.title,
    version: input.version,
    publishedAt: input.publishedAt,
    access: { mode: input.accessMode },
    theme: {
      template: input.theme.templateKey,
      tokens: tokens as unknown as Record<string, unknown>,
      palette: input.theme.palette,
      typography: input.theme.typography,
      effects: input.theme.effects,
    },
    content: input.content,
    interactions: input.interactions,
  };
}
