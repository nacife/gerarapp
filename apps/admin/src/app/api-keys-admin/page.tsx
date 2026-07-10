'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface ApiKeyRow { id: string; prefix: string; name: string; environment: string; scopes: string[]; revoked: boolean; lastUsedAt: string | null; createdAt: string; user: { name: string; email: string } }
interface ScopeItem { key: string; desc: string }

const AVAILABLE_SCOPES = [
  'projects:read', 'projects:write', 'content:read', 'content:write',
  'design:read', 'design:write', 'ai:invoke', 'publish', 'analytics:read',
  'learners:read', 'learners:write', 'inpi:read', 'inpi:write',
  'billing:read', 'jobs:read',
];

export default function ApiKeysAdminPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; revoked: number; uniqueUsers: number } | null>(null);
  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'create'>('list');

  // Form state
  const [userId, setUserId] = useState('');
  const [keyName, setKeyName] = useState('');
  const [env, setEnv] = useState<'test' | 'live'>('test');
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set(['projects:read']));
  const [createdKey, setCreatedKey] = useState<{ fullKey: string; prefix: string; id: string } | null>(null);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, [router]);
  async function load() {
    const [kRes, sRes, scRes] = await Promise.all([
      apiFetch<ApiKeyRow[]>('/admin/api-keys'),
      apiFetch<any>('/admin/api-keys/stats'),
      apiFetch<{ scopes: ScopeItem[] }>('/admin/api-keys/scopes'),
    ]);
    if (kRes.status === 401) return router.replace('/entrar');
    if (kRes.ok && kRes.data) setKeys(kRes.data);
    if (sRes.ok && sRes.data) setStats(sRes.data);
    if (scRes.ok && scRes.data) setScopes(scRes.data.scopes);
    setLoading(false);
  }

  function toggleScope(s: string) {
    const next = new Set(selectedScopes);
    next.has(s) ? next.delete(s) : next.add(s);
    setSelectedScopes(next);
  }

  async function createKey(e: FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    const res = await apiFetch<any>('/admin/api-keys', {
      method: 'POST',
      body: { userId, name: keyName, environment: env, scopes: [...selectedScopes] },
    });
    if (res.ok && res.data) {
      setCreatedKey({ fullKey: res.data.fullKey, prefix: res.data.prefix, id: res.data.id });
      load();
    } else {
      setFormMsg(res.problem?.detail ?? res.data?.error ?? 'Erro ao criar chave.');
    }
  }

  async function revoke(id: string) {
    await apiFetch(`/admin/api-keys/${id}`, { method: 'DELETE' });
    load();
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setFormMsg('Chave copiada!');
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">API Keys (Global)</h1>
        <Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link>
      </div>

      {stats && <div className="flex gap-4 text-sm"><span className="text-gray-500">Total: <b className="text-gray-200">{stats.total}</b></span><span className="text-emerald-300">Ativas: <b>{stats.active}</b></span><span className="text-red-300">Revogadas: <b>{stats.revoked}</b></span><span className="text-gray-500">Usuários: <b>{stats.uniqueUsers}</b></span></div>}

      <div className="flex gap-2">
        <button onClick={() => { setTab('list'); setCreatedKey(null); }} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'list' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500 hover:text-gray-300'}`}>Chaves ({keys.length})</button>
        <button onClick={() => setTab('create')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'create' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500 hover:text-gray-300'}`}>+ Criar chave</button>
      </div>

      {tab === 'create' && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-200">Criar API Key para usuário</h2>

          <form onSubmit={createKey} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-500">UUID do usuário</label>
                <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200 font-mono" required />
              </div>
              <div>
                <label className="text-xs text-gray-500">Nome da chave</label>
                <input value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="Minha chave de API" className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" required />
              </div>
              <div>
                <label className="text-xs text-gray-500">Ambiente</label>
                <select value={env} onChange={e => setEnv(e.target.value as any)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200">
                  <option value="test">Test (efk_test_)</option>
                  <option value="live">Live (efk_live_)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">Escopos</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {AVAILABLE_SCOPES.map((s) => (
                  <button key={s} type="button" onClick={() => toggleScope(s)}
                    className={`rounded-full px-2.5 py-0.5 text-xs transition ${selectedScopes.has(s) ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/[0.02] text-gray-500 border border-white/[0.04] hover:border-white/[0.1]'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">Criar chave</button>
            {formMsg && <p className="text-sm text-amber-300">{formMsg}</p>}
          </form>

          {createdKey && (
            <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
              <p className="text-sm font-bold text-emerald-300">🔑 Chave criada com sucesso!</p>
              <p className="text-xs text-emerald-400/80">Copie esta chave agora — ela NÃO será exibida novamente.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-zinc-950 px-3 py-2 font-mono text-sm text-emerald-300">{createdKey.fullKey}</code>
                <button onClick={() => copyToClipboard(createdKey.fullKey)} className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/30">📋 Copiar</button>
              </div>
              <p className="text-xs text-gray-500">Prefixo: {createdKey.prefix}*** · ID: {createdKey.id}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'list' && (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className={`rounded-lg border p-3 text-sm ${k.revoked ? 'border-red-500/15 bg-red-500/5 opacity-60' : 'border-white/[0.04] bg-white/[0.01]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-gray-300">{k.prefix}***</span>
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${k.environment === 'live' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{k.environment === 'live' ? 'LIVE' : 'TEST'}</span>
                  {k.name && <span className="ml-1 text-gray-500">— {k.name}</span>}
                  <span className="ml-2 text-xs text-gray-500">{k.user.name} ({k.user.email})</span>
                  <span className="ml-2 text-xs text-gray-600">{new Date(k.createdAt).toLocaleDateString('pt-BR')}{k.lastUsedAt && ` · usado ${new Date(k.lastUsedAt).toLocaleDateString('pt-BR')}`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">{(k.scopes as string[]).slice(0, 2).map((s: string) => <span key={s} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-xs text-gray-500">{s}</span>)}{(k.scopes as string[]).length > 2 && <span className="text-xs text-gray-600">+{(k.scopes as string[]).length - 2}</span>}</div>
                  {!k.revoked && <button onClick={() => revoke(k.id)} className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-300 hover:bg-red-500/20">Revogar</button>}
                  {k.revoked && <span className="text-xs text-red-400">Revogada</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
