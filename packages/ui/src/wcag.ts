import type { PaletteColors } from './tokens';

export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razão de contraste WCAG entre duas cores (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function meetsAa(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? AA_LARGE : AA_NORMAL);
}

function mix(hex: string, target: [number, number, number], t: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (target[0] - r) * t, g + (target[1] - g) * t, b + (target[2] - b) * t);
}

export const lighten = (hex: string, amount: number): string => mix(hex, [255, 255, 255], amount);
export const darken = (hex: string, amount: number): string => mix(hex, [0, 0, 0], amount);

/** Ajusta `fg` (clareando/escurecendo) até atingir a razão alvo sobre `bg`. */
export function adjustForContrast(fg: string, bg: string, target = AA_NORMAL): string {
  if (contrastRatio(fg, bg) >= target) return fg;
  const toward: [number, number, number] = relativeLuminance(bg) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const candidate = mix(fg, toward, t);
    if (contrastRatio(candidate, bg) >= target) return candidate;
  }
  return rgbToHex(...toward);
}

export interface WcagCheck {
  pass: boolean;
  failures: { pair: string; ratio: number }[];
}

/** Verifica os pares texto/fundo essenciais de uma paleta (US-DSG-01). */
export function checkPaletteWcagAa(colors: PaletteColors): WcagCheck {
  // Apenas pares texto/fundo (a primary é fundo de botão/acento, não texto).
  const pairs: [string, string, string, number][] = [
    ['text/bg', colors.text, colors.bg, AA_NORMAL],
    ['text/surface', colors.text, colors.surface, AA_NORMAL],
    ['muted/bg', colors.muted, colors.bg, AA_LARGE],
    ['muted/surface', colors.muted, colors.surface, AA_LARGE],
  ];
  const failures = pairs
    .map(([pair, fg, bg, target]) => ({ pair, ratio: contrastRatio(fg, bg), target }))
    .filter((r) => r.ratio < r.target)
    .map(({ pair, ratio }) => ({ pair, ratio: Math.round(ratio * 100) / 100 }));
  return { pass: failures.length === 0, failures };
}

/** Corrige uma paleta para passar em WCAG AA, ajustando as cores reprovadas. */
export function ensureWcagAa(colors: PaletteColors): { colors: PaletteColors; adjusted: string[] } {
  const out = { ...colors };
  const adjusted: string[] = [];
  const fix = (key: keyof PaletteColors, bg: string, target: number) => {
    const next = adjustForContrast(out[key], bg, target);
    if (next !== out[key]) {
      out[key] = next;
      adjusted.push(`${key}/${bg === out.bg ? 'bg' : 'surface'}`);
    }
  };
  fix('text', out.bg, AA_NORMAL);
  fix('text', out.surface, AA_NORMAL);
  fix('muted', out.bg, AA_LARGE);
  return { colors: out, adjusted };
}
