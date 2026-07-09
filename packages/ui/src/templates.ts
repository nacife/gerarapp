export interface TemplateTokens {
  key: string;
  name: string;
  navigation: 'cards' | 'editorial' | 'immersive' | 'text';
  surface: 'soft-shadow' | 'glass' | 'flat' | 'bordered';
  radius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  typography: { heading: string; body: string; scale: number };
  motion: { level: 'subtle' | 'rich'; respectsReducedMotion: boolean };
}

/** 4 templates do MVP (RF-03). Fonte única de tokens consumida pelo runtime. */
export const TEMPLATE_TOKENS: Record<string, TemplateTokens> = {
  modern: {
    key: 'modern',
    name: 'Moderno',
    navigation: 'cards',
    surface: 'soft-shadow',
    radius: 'lg',
    typography: { heading: 'Inter', body: 'Inter', scale: 1.25 },
    motion: { level: 'subtle', respectsReducedMotion: true },
  },
  contemporary: {
    key: 'contemporary',
    name: 'Contemporâneo',
    navigation: 'editorial',
    surface: 'flat',
    radius: 'sm',
    typography: { heading: 'Lora', body: 'Inter', scale: 1.333 },
    motion: { level: 'subtle', respectsReducedMotion: true },
  },
  futurist: {
    key: 'futurist',
    name: 'Futurista',
    navigation: 'immersive',
    surface: 'glass',
    radius: 'xl',
    typography: { heading: 'Space Grotesk', body: 'Inter', scale: 1.25 },
    motion: { level: 'rich', respectsReducedMotion: true },
  },
  minimal: {
    key: 'minimal',
    name: 'Minimalista',
    navigation: 'text',
    surface: 'flat',
    radius: 'none',
    typography: { heading: 'Inter', body: 'Inter', scale: 1.2 },
    motion: { level: 'subtle', respectsReducedMotion: true },
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_TOKENS);

const RADIUS_PX: Record<TemplateTokens['radius'], string> = {
  none: '0px',
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '24px',
};

export function radiusPx(tokens: TemplateTokens): string {
  return RADIUS_PX[tokens.radius];
}
