'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'active' | 'suspended' | 'pending_deletion';
  createdAt: string;
  emailVerifiedAt: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300',
  suspended: 'bg-rose-500/15 text-rose-300',
  pending_deletion: 'bg-amber-500/15 text-amber-300',
};

export default function UsuariosPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState(false);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    const qs = new URLSearchParams();
    if (query) qs.set('query', query);
    if (status) qs.set('status', status);
    const res = await apiFetch<UserRow[]>(`/admin/users?${qs.toString()}`);
    if (res.status === 401) return router.replace('/entrar');
    if (res.status === 403) return setDenied(true);
    if (res.ok && res.data) setRows(res.data);
    setLoaded(true);
  }

  useEffect(() => {
    void search();
  }, []);

  if (denied) {
    return (
      <main className="grid min-h-screen place-items-center text-rose-400">
        Acesso restrito a administradores.
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Painel admin
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Usuários & Organizações</h1>
        </div>
      </header>

      <form onSubmit={search} className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="suspended">Suspenso</option>
          <option value="pending_deletion">Exclusão pendente</option>
        </select>
        <button className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950">
          Buscar
        </button>
      </form>

      {!loaded ? (
        <p className="text-zinc-500">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum usuário encontrado.</p>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {rows.map((u) => (
            <Link
              key={u.id}
              href={`/usuarios/${u.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-zinc-900/60"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{u.name}</p>
                <p className="truncate text-xs text-zinc-500">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs capitalize text-zinc-400">
                  {u.role}
                </span>
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[u.status] ?? ''}`}>
                  {u.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
