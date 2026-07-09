import { describe, expect, it } from 'vitest';
import {
  adjustForContrast,
  buildPaletteFromBrand,
  checkPaletteWcagAa,
  contrastRatio,
  deriveDarkMode,
  meetsAa,
} from './index';

describe('contrastRatio', () => {
  it('preto/branco = 21', () => {
    expect(Math.round(contrastRatio('#000000', '#ffffff'))).toBe(21);
  });
  it('mesma cor = 1', () => {
    expect(contrastRatio('#123456', '#123456')).toBe(1);
  });
  it('meetsAa reprova baixo contraste', () => {
    expect(meetsAa('#777777', '#888888')).toBe(false);
    expect(meetsAa('#000000', '#ffffff')).toBe(true);
  });
});

describe('adjustForContrast', () => {
  it('ajusta um par reprovado até passar em AA', () => {
    const fixed = adjustForContrast('#aaaaaa', '#ffffff', 4.5);
    expect(contrastRatio(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('mantém a cor quando já passa', () => {
    expect(adjustForContrast('#000000', '#ffffff')).toBe('#000000');
  });
});

describe('buildPaletteFromBrand (US-DSG-01)', () => {
  it('produz paleta clara e escura que passam em WCAG AA', () => {
    for (const brand of ['#0ea5e9', '#f59e0b', '#84cc16', '#111827']) {
      const { colors } = buildPaletteFromBrand(brand);
      expect(checkPaletteWcagAa(colors.light).pass, `light ${brand}`).toBe(true);
      expect(checkPaletteWcagAa(colors.dark).pass, `dark ${brand}`).toBe(true);
    }
  });
});

describe('deriveDarkMode', () => {
  it('gera modo escuro que mantém contraste AA', () => {
    const { colors } = buildPaletteFromBrand('#0ea5e9');
    const dark = deriveDarkMode(colors.light);
    expect(checkPaletteWcagAa(dark).pass).toBe(true);
  });
});
