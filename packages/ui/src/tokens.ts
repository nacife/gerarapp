/** Cores de uma paleta para um modo (claro ou escuro). */
export interface PaletteColors {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface PaletteModes {
  light: PaletteColors;
  dark: PaletteColors;
}

/**
 * Converte as cores de uma paleta em variáveis CSS (`--ef-*`) consumidas pelos
 * templates no runtime (M4). Chaves em kebab-case.
 */
export function paletteToCssVars(colors: PaletteColors): Record<string, string> {
  return {
    '--ef-bg': colors.bg,
    '--ef-surface': colors.surface,
    '--ef-text': colors.text,
    '--ef-muted': colors.muted,
    '--ef-border': colors.border,
    '--ef-primary': colors.primary,
    '--ef-secondary': colors.secondary,
    '--ef-accent': colors.accent,
  };
}

/** Serializa as variáveis CSS em uma string para atributo `style`. */
export function cssVarsToStyle(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}
