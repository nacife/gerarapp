// `type` (não `interface`): tipos com índice implícito são atribuíveis ao
// `Prisma.InputJsonValue`; interfaces nomeadas não são.
export type PaletteColors = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  secondary: string;
  accent: string;
};

export type PaletteSeed = {
  key: string;
  name: string;
  colors: { light: PaletteColors; dark: PaletteColors };
};

/** Neutros fixos claros/escuros; cada paleta varia primary/secondary/accent. */
function palette(
  key: string,
  name: string,
  brand: { primary: string; secondary: string; accent: string },
): PaletteSeed {
  return {
    key,
    name,
    colors: {
      light: {
        bg: '#ffffff',
        surface: '#f4f6f8',
        text: '#0f172a',
        muted: '#5b6472',
        border: '#e2e8f0',
        ...brand,
      },
      dark: {
        bg: '#0b1120',
        surface: '#141b2d',
        text: '#f8fafc',
        muted: '#94a3b8',
        border: '#1f2937',
        ...brand,
      },
    },
  };
}

/**
 * 15 paletas curadas do MVP (PRD §0.4 M0). A verificação WCAG AA programática
 * é requisito da M4 — aqui são marcadas como curadas. TODO(prd:RF-03).
 */
export const PALETTES: PaletteSeed[] = [
  palette('oceano', 'Oceano', { primary: '#0ea5e9', secondary: '#0369a1', accent: '#22d3ee' }),
  palette('neon', 'Neon', { primary: '#a855f7', secondary: '#ec4899', accent: '#22d3ee' }),
  palette('floresta', 'Floresta', { primary: '#16a34a', secondary: '#065f46', accent: '#84cc16' }),
  palette('por-do-sol', 'Pôr do Sol', { primary: '#f97316', secondary: '#db2777', accent: '#facc15' }),
  palette('ardosia', 'Ardósia', { primary: '#475569', secondary: '#1e293b', accent: '#38bdf8' }),
  palette('ameixa', 'Ameixa', { primary: '#7c3aed', secondary: '#4c1d95', accent: '#c084fc' }),
  palette('cafe', 'Café', { primary: '#92400e', secondary: '#451a03', accent: '#d97706' }),
  palette('coral', 'Coral', { primary: '#f43f5e', secondary: '#be123c', accent: '#fb7185' }),
  palette('artico', 'Ártico', { primary: '#2563eb', secondary: '#1e40af', accent: '#7dd3fc' }),
  palette('grafite', 'Grafite', { primary: '#111827', secondary: '#374151', accent: '#f59e0b' }),
  palette('menta', 'Menta', { primary: '#10b981', secondary: '#0f766e', accent: '#5eead4' }),
  palette('lavanda', 'Lavanda', { primary: '#8b5cf6', secondary: '#6d28d9', accent: '#a5b4fc' }),
  palette('citrico', 'Cítrico', { primary: '#65a30d', secondary: '#3f6212', accent: '#fde047' }),
  palette('rubi', 'Rubi', { primary: '#e11d48', secondary: '#9f1239', accent: '#fda4af' }),
  palette('indigo', 'Índigo', { primary: '#4f46e5', secondary: '#3730a3', accent: '#818cf8' }),
  // Premium — M10+
  palette('ciano-premium', 'Ciano Premium', { primary: '#06b6d4', secondary: '#0891b2', accent: '#22d3ee' }),
  palette('grafite-premium', 'Grafite Premium', { primary: '#334155', secondary: '#1e293b', accent: '#06b6d4' }),
];
