'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface ApiKeyRow { id: string; prefix: string; scopes: string[]; revoked: boolean; lastUsedAt: string | null; createdAt: string; user: { name: string; email: string } }

export default function ApiKeysAdminPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; revoked: number; uniqueUsers: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch<ApiKeyRow[]>('/admin/api-keys'), apiFetch<any>('/admin/api-keys/stats')]).then(([kRes, sRes]) => {
      if (kRes.status === 401) return router.replace('/entrar');
      if (kRes.ok && kRes.data) setKeys(kRes.data);
      if (sRes.ok && sRes.data) setStats(sRes.data);
      setLoading(false);
    });
  }, [router]);

  async function revoke(id: string) {
    await apiFetch(`/admin/api-keys/${id}`, { method: 'DELETE' });
    const kRes = await apiFetch<ApiKeyRow[]>('/admin/api-keys');
    if (kRes.ok && kRes.data) setKeys(kRes.data);
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">API Keys (Global)</h1>
        <Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link>
      </div>
      {stats && <div className="flex gap-4 text-sm"><span className="text-gray-500">Total: <b className="text-gray-200">{stats.total}</b></span><span className="text-emerald-300">Ativas: <b>{stats.active}</b></span><span className="text-red-300">Revogadas: <b>{stats.revoked}</b></span><span className="text-gray-500">Usuários: <b>{stats.uniqueUsers}</b></span></div>}
      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.id} className={`rounded-lg border p-3 text-sm ${k.revoked ? 'border-red-500/15 bg-red-500/5 opacity-60' : 'border-white/[0.04] bg-white/[0.01]'}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-gray-300">{k.prefix}***</span>
                <span className="ml-2 text-xs text-gray-500">{k.user.name} ({k.user.email})</span>
                <span className="ml-2 text-xs text-gray-600">{new Date(k.createdAt).toLocaleDateString('pt-BR')}{k.lastUsedAt && ` · último uso: ${new Date(k.lastUsedAt).toLocaleDateString('pt-BR')}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">{((k.scopes as string[]) ?? []).slice(0, 3).map((s: string) => <span key={s} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-xs text-gray-500">{s}</span>)}</div>
                {!k.revoked && <button onClick={() => revoke(k.id)} className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-300 hover:bg-red-500/20">Revogar</button>}
                {k.revoked && <span className="text-xs text-red-400">Revogada</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
