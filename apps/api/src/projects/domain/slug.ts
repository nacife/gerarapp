import { randomBytes } from 'node:crypto';

/** Gera um slug base a partir do título (sem acentos, kebab-case). */
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'app';
}

/** Sufixo curto aleatório para desambiguar slugs. */
export function slugSuffix(): string {
  return randomBytes(4).toString('hex').slice(0, 6);
}
