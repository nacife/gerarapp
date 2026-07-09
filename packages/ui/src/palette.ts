import type { PaletteColors, PaletteModes } from './tokens';
import { darken, ensureWcagAa, lighten } from './wcag';

const LIGHT_NEUTRALS = {
  bg: '#ffffff',
  surface: '#f4f6f8',
  text: '#0f172a',
  muted: '#5b6472',
  border: '#e2e8f0',
};
const DARK_NEUTRALS = {
  bg: '#0b1120',
  surface: '#141b2d',
  text: '#f8fafc',
  muted: '#94a3b8',
  border: '#1f2937',
};

export interface BuiltPalette {
  colors: PaletteModes;
  adjusted: string[];
}

/**
 * Constrói uma paleta (claro + escuro) a partir de uma cor de marca, derivando
 * secundária/acento e garantindo WCAG AA (US-DSG-01: paleta do logotipo).
 */
export function buildPaletteFromBrand(primary: string): BuiltPalette {
  const brand = {
    primary,
    secondary: darken(primary, 0.2),
    accent: lighten(primary, 0.25),
  };
  const light = ensureWcagAa({ ...LIGHT_NEUTRALS, ...brand });
  const dark = ensureWcagAa({ ...DARK_NEUTRALS, ...brand });
  return {
    colors: { light: light.colors, dark: dark.colors },
    adjusted: [...new Set([...light.adjusted, ...dark.adjusted])],
  };
}

/**
 * Gera o modo escuro de uma paleta clara mantendo a marca e o contraste AA
 * (US-DSG-01: "Gerar modo escuro").
 */
export function deriveDarkMode(light: PaletteColors): PaletteColors {
  return ensureWcagAa({
    ...DARK_NEUTRALS,
    primary: light.primary,
    secondary: light.secondary,
    accent: light.accent,
  }).colors;
}
