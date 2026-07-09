export interface TemplateSeed {
  key: string;
  name: string;
  minPlanTier: number;
  tokens: {
    navigation: 'cards' | 'editorial' | 'immersive' | 'text';
    surface: 'soft-shadow' | 'glass' | 'flat' | 'bordered';
    radius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    typography: { heading: string; body: string; scale: number };
    motion: { level: 'subtle' | 'rich'; respectsReducedMotion: boolean };
  };
}

/**
 * 4 templates do MVP (PRD Fase 1 / M4). Os 4 restantes (academic, playful,
 * corporate, brutalist) entram na Fase 2 — TODO(prd:RF-03).
 */
export const TEMPLATES: TemplateSeed[] = [
  {
    key: 'modern',
    name: 'Moderno',
    minPlanTier: 0,
    tokens: {
      navigation: 'cards',
      surface: 'soft-shadow',
      radius: 'lg',
      typography: { heading: 'Inter', body: 'Inter', scale: 1.25 },
      motion: { level: 'subtle', respectsReducedMotion: true },
    },
  },
  {
    key: 'contemporary',
    name: 'Contemporâneo',
    minPlanTier: 0,
    tokens: {
      navigation: 'editorial',
      surface: 'flat',
      radius: 'sm',
      typography: { heading: 'Lora', body: 'Inter', scale: 1.333 },
      motion: { level: 'subtle', respectsReducedMotion: true },
    },
  },
  {
    key: 'futurist',
    name: 'Futurista',
    minPlanTier: 0,
    tokens: {
      navigation: 'immersive',
      surface: 'glass',
      radius: 'xl',
      typography: { heading: 'Space Grotesk', body: 'Inter', scale: 1.25 },
      motion: { level: 'rich', respectsReducedMotion: true },
    },
  },
  {
    key: 'minimal',
    name: 'Minimalista',
    minPlanTier: 0,
    tokens: {
      navigation: 'text',
      surface: 'flat',
      radius: 'none',
      typography: { heading: 'Inter', body: 'Inter', scale: 1.2 },
      motion: { level: 'subtle', respectsReducedMotion: true },
    },
  },
];
