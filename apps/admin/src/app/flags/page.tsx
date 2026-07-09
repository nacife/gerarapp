'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface Flag {
  id: string;
  key: string;
  defaultOn: boolean;
  rolloutPct: number;
}

export default function FlagsPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [newKey, setNewKey] = useState('');
  const [newRollout, setNewRollout] = useState(0);

  const [pinKey, setPinKey] = useState<string | null>(null);
  const [pinSubjectType, setPinSubjectType] = useState<'user' | 'org' | 'plan'>('user');
  const [pinSubjectId, setPinSubjectId] = useState('');
  const [pinEnabled, setPinEnabled] = useState(true);

  async function load() {
    const res = await apiFetch<Flag[]>('/admin/feature-flags');
    if (res.status === 401) return router.replace('/entrar');
    if (res.status === 403) return setDenied(true);
    if (res.ok && res.data) setFlags(res.data);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createFlag(e: FormEvent) {
    e.preventDefault();
    if (!newKey.trim()) return;
    const res = await apiFetch('/admin/feature-flags', {
      method: 'POST',
      body: { key: newKey, defaultOn: false, rolloutPct: newRollout },
    });
    if (!res.ok) return setMsg(res.problem?.detail ?? 'Falha ao criar flag.');
    setNewKey('');
    setNewRollout(0);
    await load();
  }

  async function updateRollout(key: string, rolloutPct: number) {
    await apiFetch(`/admin/feature-flags/${key}`, { method: 'PUT', body: { rolloutPct } });
    await load();
  }

  async function toggleDefault(key: string, defaultOn: boolean) {
    await apiFetch(`/admin/feature-flags/${key}`, { method: 'PUT', body: { defaultOn } });
    await load();
  }

  async function pin(e: FormEvent) {
    e.preventDefault();
    if (!pinKey || !pinSubjectId.trim()) return;
    const res = await apiFetch(`/admin/feature-flags/${pinKey}/pin`, {
      method: 'POST',
      body: { subjectType: pinSubjectType, subjectId: pinSubjectId, enabled: pinEnabled },
    });
    setMsg(res.ok ? `Flag "${pinKey}" fixada para ${pinSubjectType} ${pinSubjectId}.` : (res.problem?.detail ?? 'Falha ao fixar.'));
    if (res.ok) { setPinKey(null); setPinSubjectId(''); }
  }

  if (denied) {
    return <main className="grid min-h-screen place-items-center text-rose-400">Acesso restrito a administradores.</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Painel admin
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Feature Flags</h1>
        <p className="text-sm text-zinc-500">Rollout percentual determinístico por usuário (RF-13).</p>
      </div>

      <form onSubmit={createFlag} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="chave_snake_case"
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
        />
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Rollout inicial
          <input
            type="number"
            min={0}
            max={100}
            value={newRollout}
            onChange={(e) => setNewRollout(Number(e.target.value))}
            className="w-20 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm outline-none"
          />
          %
        </label>
        <button className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950">
          Criar flag
        </button>
      </form>

      {msg && <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">{msg}</p>}

      {!loaded ? (
        <p className="text-zinc-500">Carregando…</p>
      ) : flags.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma flag criada ainda.</p>
      ) : (
        <div className="space-y-3">
          {flags.map((f) => (
            <div key={f.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{f.key}</span>
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={f.defaultOn}
                    onChange={(e) => toggleDefault(f.key, e.target.checked)}
                  />
                  default ligado
                </label>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={f.rolloutPct}
                  onChange={(e) => updateRollout(f.key, Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-12 text-right text-sm text-zinc-400">{f.rolloutPct}%</span>
              </div>
              <button
                onClick={() => setPinKey(pinKey === f.key ? null : f.key)}
                className="mt-2 text-xs text-sky-400 hover:underline"
              >
                {pinKey === f.key ? 'cancelar' : 'fixar para usuário/org/plano →'}
              </button>
              {pinKey === f.key && (
                <form onSubmit={pin} className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
                  <select
                    value={pinSubjectType}
                    onChange={(e) => setPinSubjectType(e.target.value as 'user' | 'org' | 'plan')}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm"
                  >
                    <option value="user">usuário</option>
                    <option value="org">organização</option>
                    <option value="plan">plano</option>
                  </select>
                  <input
                    value={pinSubjectId}
                    onChange={(e) => setPinSubjectId(e.target.value)}
                    placeholder="ID do sujeito (UUID)"
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={pinEnabled}
                      onChange={(e) => setPinEnabled(e.target.checked)}
                    />
                    ligado
                  </label>
                  <button className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-950">
                    Fixar
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
