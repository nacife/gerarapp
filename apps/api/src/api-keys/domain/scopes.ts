/** Catálogo de escopos da API pública (Parte 6.B.2). */
export const API_KEY_SCOPES = [
  'projects:read',
  'projects:write',
  'content:read',
  'content:write',
  'jobs:read',
  'ai:invoke',
  'design:read',
  'design:write',
  'publish',
  'analytics:read',
  'learners:read',
  'learners:write',
  'inpi:read',
  'inpi:write',
  'billing:read',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export function isValidScope(value: string): value is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(value);
}

/** `<namespace>:*` concede todos os escopos daquele namespace (ex.: `content:*` → read+write). */
export function hasScope(granted: readonly string[], required: ApiKeyScope): boolean {
  if (granted.includes(required)) return true;
  const namespace = required.split(':')[0];
  return granted.includes(`${namespace}:*`);
}
