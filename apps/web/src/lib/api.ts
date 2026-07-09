const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export interface Problem {
  type?: string;
  title: string;
  detail?: string;
  status?: number;
  [key: string]: unknown;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  problem: Problem | null;
}

/** Cliente da API para o browser — envia cookies (sessão httpOnly). */
export async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'include',
      headers: {
        ...(opts.body ? { 'content-type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      problem: { title: 'Falha de conexão com a API.' },
    };
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* sem corpo */
  }

  if (res.ok) return { ok: true, status: res.status, data: json as T, problem: null };
  return { ok: false, status: res.status, data: null, problem: (json as Problem) ?? { title: 'Erro' } };
}
