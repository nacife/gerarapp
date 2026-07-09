export interface RuntimeTheme {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  secondary: string;
  accent: string;
}

export const FALLBACK_THEME: RuntimeTheme = {
  bg: '#0b1120',
  surface: '#141b2d',
  text: '#f8fafc',
  muted: '#94a3b8',
  border: '#1f2937',
  primary: '#0ea5e9',
  secondary: '#0369a1',
  accent: '#22d3ee',
};

export interface CompletionDetail {
  correct?: boolean;
  quality?: number;
  [key: string]: unknown;
}
