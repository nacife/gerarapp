import { describe, expect, it } from 'vitest';
import { cssVarsToStyle, paletteToCssVars, type PaletteColors } from './tokens';

const colors: PaletteColors = {
  bg: '#ffffff',
  surface: '#f4f6f8',
  text: '#0f172a',
  muted: '#5b6472',
  border: '#e2e8f0',
  primary: '#0ea5e9',
  secondary: '#0369a1',
  accent: '#22d3ee',
};

describe('paletteToCssVars', () => {
  it('mapeia todas as cores para variáveis --ef-*', () => {
    const vars = paletteToCssVars(colors);
    expect(vars['--ef-primary']).toBe('#0ea5e9');
    expect(Object.keys(vars)).toHaveLength(8);
  });

  it('serializa para string de style', () => {
    const style = cssVarsToStyle(paletteToCssVars(colors));
    expect(style).toContain('--ef-bg: #ffffff');
  });
});
