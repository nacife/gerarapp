import type { HttpResponse } from './pipeline';

const TIMEOUT_MS = 10_000;
const MAX_BODY_CHARS = 4000;

/** POST simples com timeout — usa o `fetch` global do Node (18+). */
export async function httpPost(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<HttpResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, MAX_BODY_CHARS) };
  } finally {
    clearTimeout(timeout);
  }
}
