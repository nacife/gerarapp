'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';

interface ApiKeyRow {
  id: string;
  name: string;
  environment: 'live' | 'test';
  projectId: string | null;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  projectId: string | null;
  active: boolean;
  createdAt: string;
}

interface DeliveryRow {
  id: string;
  eventType: string;
  status: 'pending' | 'success' | 'failed' | 'exhausted';
  attempts: number;
  responseStatus: number | null;
  lastAttemptAt: string | null;
  createdAt: string;
}

const DELIVERY_LABEL: Record<DeliveryRow['status'], string> = {
  pending: 'pendente',
  success: 'entregue',
  failed: 'falhou (vai retentar)',
  exhausted: 'esgotada',
};

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `whsec_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export default function ApiSettingsPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // API keys
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [allScopes, setAllScopes] = useState<string[]>([]);
  const [keyName, setKeyName] = useState('');
  const [keyEnv, setKeyEnv] = useState<'live' | 'test'>('live');
  const [keyScopes, setKeyScopes] = useState<Set<string>>(new Set());
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Webhooks
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [allEvents, setAllEvents] = useState<string[]>([]);
  const [hookUrl, setHookUrl] = useState('');
  const [hookSecret, setHookSecret] = useState('');
  const [hookEvents, setHookEvents] = useState<Set<string>>(new Set());
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);

  async function load() {
    const [me, keysRes, scopesRes, hooksRes, eventsRes] = await Promise.all([
      apiFetch('/auth/me'),
      apiFetch<ApiKeyRow[]>('/api-keys'),
      apiFetch<{ scopes: string[] }>('/api-keys/scopes'),
      apiFetch<WebhookRow[]>('/webhooks'),
      apiFetch<{ events: string[] }>('/webhooks/events'),
    ]);
    if (!me.ok) return router.replace('/entrar');
    if (keysRes.ok && keysRes.data) setKeys(keysRes.data);
    if (scopesRes.ok && scopesRes.data) setAllScopes(scopesRes.data.scopes);
    if (hooksRes.ok && hooksRes.data) setHooks(hooksRes.data);
    if (eventsRes.ok && eventsRes.data) setAllEvents(eventsRes.data.events);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  function toggle(set: Set<string>, value: string, update: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  }

  async function createKey(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await apiFetch<{ key: string }>('/api-keys', {
      method: 'POST',
      body: { name: keyName, environment: keyEnv, scopes: [...keyScopes] },
    });
    setBusy(false);
    if (!res.ok || !res.data) return setMsg(res.problem?.detail ?? 'Falha ao criar a chave.');
    setCreatedKey(res.data.key);
    setCopied(false);
    setKeyName('');
    setKeyScopes(new Set());
    await load();
  }

  async function revokeKey(id: string) {
    if (!window.confirm('Revogar esta chave? Integrações que a usam vão parar imediatamente.')) return;
    await apiFetch(`/api-keys/${id}`, { method: 'DELETE' });
    await load();
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
  }

  async function createHook(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await apiFetch('/webhooks', {
      method: 'POST',
      body: { url: hookUrl, secret: hookSecret, events: [...hookEvents] },
    });
    setBusy(false);
    if (!res.ok) return setMsg(res.problem?.detail ?? 'Falha ao criar o webhook.');
    setHookUrl('');
    setHookSecret('');
    setHookEvents(new Set());
    setMsg('Webhook criado. Guarde o segredo: ele assina cada entrega (X-EduForge-Signature).');
    await load();
  }

  async function toggleHook(hook: WebhookRow) {
    await apiFetch(`/webhooks/${hook.id}`, { method: 'PATCH', body: { active: !hook.active } });
    await load();
  }

  async function removeHook(id: string) {
    if (!window.confirm('Remover este webhook?')) return;
    await apiFetch(`/webhooks/${id}`, { method: 'DELETE' });
    if (deliveriesFor === id) setDeliveriesFor(null);
    await load();
  }

  async function refreshDeliveries(id: string) {
    const res = await apiFetch<DeliveryRow[]>(`/webhooks/${id}/deliveries`);
    if (res.ok && res.data) {
      setDeliveries(res.data);
      setDeliveriesFor(id);
    }
  }

  async function showDeliveries(id: string) {
    if (deliveriesFor === id) return setDeliveriesFor(null);
    await refreshDeliveries(id);
  }

  async function redeliver(deliveryId: string) {
    const res = await apiFetch(`/webhooks/deliveries/${deliveryId}/redeliver`, { method: 'POST' });
    setMsg(res.ok ? 'Reentrega enfileirada.' : (res.problem?.detail ?? 'Falha ao reenviar.'));
    if (deliveriesFor) await refreshDeliveries(deliveriesFor);
  }

  if (!loaded) {
    return <main className="grid min-h-screen place-items-center text-slate-400">Carregando…</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/configuracoes" className="text-sm text-sky-400 hover:underline">
          ← configurações
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">API e Webhooks</h1>
        <p className="mt-1 text-sm text-slate-400">
          Integre o EduForge aos seus sistemas — contrato completo em{' '}
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/v1/openapi.json`}
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 hover:underline"
          >
            /v1/openapi.json
          </a>
          .
        </p>
      </div>

      {msg && <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">{msg}</p>}

      {createdKey && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
          <p className="text-sm font-semibold text-amber-200">Copie sua chave agora — ela não será exibida de novo.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-slate-950 px-3 py-2 font-mono text-sm text-emerald-300">
              {createdKey}
            </code>
            <button
              onClick={() => void copyKey()}
              className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-slate-500"
            >
              {copied ? '✓ Copiada' : 'Copiar'}
            </button>
          </div>
          <button onClick={() => setCreatedKey(null)} className="mt-3 text-xs text-slate-400 hover:underline">
            Já guardei, fechar
          </button>
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">API keys</h2>

        {keys.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma chave criada ainda.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {k.name}{' '}
                      <span
                        className={`ml-1 rounded px-1.5 py-0.5 text-[10px] uppercase ${
                          k.environment === 'live' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'
                        }`}
                      >
                        {k.environment}
                      </span>
                      {k.revokedAt && (
                        <span className="ml-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] uppercase text-rose-300">
                          revogada
                        </span>
                      )}
                    </p>
                    <p className="truncate font-mono text-xs text-slate-500">{k.keyPrefix}…</p>
                  </div>
                  {!k.revokedAt && (
                    <button onClick={() => void revokeKey(k.id)} className="shrink-0 text-xs text-rose-400 hover:underline">
                      Revogar
                    </button>
                  )}
                </div>
                <p className="mt-1 flex flex-wrap gap-1">
                  {k.scopes.map((s) => (
                    <span key={s} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {s}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={createKey} className="space-y-3 border-t border-slate-800 pt-4">
          <div className="flex gap-2">
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Nome da chave (ex.: Integração LMS)"
              required
              className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <select
              value={keyEnv}
              onChange={(e) => setKeyEnv(e.target.value as 'live' | 'test')}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
            >
              <option value="live">live</option>
              <option value="test">test</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allScopes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(keyScopes, s, setKeyScopes)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  keyScopes.has(s)
                    ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            disabled={busy || keyScopes.size === 0 || !keyName}
            className="rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Criar chave
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Webhooks</h2>

        {hooks.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum webhook configurado.</p>
        ) : (
          <div className="space-y-2">
            {hooks.map((h) => (
              <div key={h.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-mono text-xs">{h.url}</p>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <button onClick={() => void showDeliveries(h.id)} className="text-sky-400 hover:underline">
                      {deliveriesFor === h.id ? 'Ocultar' : 'Entregas'}
                    </button>
                    <button onClick={() => void toggleHook(h)} className="text-slate-400 hover:underline">
                      {h.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => void removeHook(h.id)} className="text-rose-400 hover:underline">
                      Remover
                    </button>
                  </div>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-1">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                      h.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/40 text-slate-400'
                    }`}
                  >
                    {h.active ? 'ativo' : 'inativo'}
                  </span>
                  {h.events.map((ev) => (
                    <span key={ev} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {ev}
                    </span>
                  ))}
                </p>

                {deliveriesFor === h.id && (
                  <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">
                    {deliveries.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhuma entrega ainda.</p>
                    ) : (
                      deliveries.map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-slate-400">
                            {d.eventType} ·{' '}
                            <span
                              className={
                                d.status === 'success'
                                  ? 'text-emerald-400'
                                  : d.status === 'exhausted'
                                    ? 'text-rose-400'
                                    : 'text-amber-300'
                              }
                            >
                              {DELIVERY_LABEL[d.status]}
                            </span>{' '}
                            · {d.attempts}× · HTTP {d.responseStatus ?? '—'}
                          </span>
                          {d.status !== 'pending' && (
                            <button onClick={() => void redeliver(d.id)} className="shrink-0 text-sky-400 hover:underline">
                              Reenviar
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={createHook} className="space-y-3 border-t border-slate-800 pt-4">
          <input
            value={hookUrl}
            onChange={(e) => setHookUrl(e.target.value)}
            placeholder="https://seu-sistema.com/webhooks/eduforge"
            type="url"
            required
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <div className="flex gap-2">
            <input
              value={hookSecret}
              onChange={(e) => setHookSecret(e.target.value)}
              placeholder="Segredo de assinatura (mín. 16 caracteres)"
              required
              minLength={16}
              className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-sm outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => setHookSecret(randomSecret())}
              className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-slate-500"
            >
              Gerar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allEvents.map((ev) => (
              <button
                key={ev}
                type="button"
                onClick={() => toggle(hookEvents, ev, setHookEvents)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  hookEvents.has(ev)
                    ? 'border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-200'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {ev}
              </button>
            ))}
          </div>
          <button
            disabled={busy || hookEvents.size === 0 || !hookUrl || hookSecret.length < 16}
            className="rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Criar webhook
          </button>
        </form>
      </section>
    </main>
  );
}
