'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface ProviderInfo { model: string; hasKey: boolean; keyPreview: string | null; keySource: string }
interface AiConfig { provider: string; providers: Record<string, ProviderInfo>; fallbackOrder: string[]; mockFallback: boolean; note: string }
interface AiUsage { interactions: number; tutor: number; podcast: number; illustration: number; total: number }

const PROVIDER_META: Record<string, { name: string; color: string; models: string[] }> = {
  anthropic: { name: 'Anthropic (Claude)', color: 'border-amber-500/30 bg-amber-500/5', models: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5'] },
  openai: { name: 'OpenAI (GPT-4o)', color: 'border-emerald-500/30 bg-emerald-500/5', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  deepseek: { name: 'DeepSeek', color: 'border-purple-500/30 bg-purple-500/5', models: ['deepseek-chat', 'deepseek-reasoner'] },
};

export default function AiConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selProvider, setSelProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [selModel, setSelModel] = useState('claude-sonnet-4-6');
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'provider'>('overview');

  useEffect(() => {
    Promise.all([apiFetch<AiConfig>('/admin/ai-config'), apiFetch<AiUsage>('/admin/ai-config/usage')]).then(([c, u]) => {
      if (c.status === 401) return router.replace('/entrar');
      if (c.ok && c.data) setConfig(c.data);
      if (u.ok && u.data) setUsage(u.data);
      setLoading(false);
    });
  }, [router]);

  function selectProvider(p: string) {
    setSelProvider(p);
    setApiKey('');
    const models = PROVIDER_META[p]?.models ?? [];
    setSelModel(models[0] ?? '');
    setTab('provider');
  }

  async function saveKey(e: FormEvent) { e.preventDefault();
    const res = await apiFetch('/admin/ai-config/provider', { method: 'POST', body: { provider: selProvider, apiKey, model: selModel } });
    setMsg(res.ok ? `${selProvider}: chave salva ✅` : 'Erro');
    setApiKey('');
    const c = await apiFetch<AiConfig>('/admin/ai-config'); if (c.ok && c.data) setConfig(c.data);
  }

  async function clearKey(p: string) {
    await apiFetch('/admin/ai-config/provider/clear', { method: 'POST', body: { provider: p } });
    const c = await apiFetch<AiConfig>('/admin/ai-config'); if (c.ok && c.data) setConfig(c.data);
    setMsg(`${p}: chave removida`);
  }

  async function moveUp(idx: number) {
    if (!config || idx === 0) return;
    const order = [...config.fallbackOrder];
    [order[idx - 1], order[idx]] = [order[idx]!, order[idx - 1]!];
    await apiFetch('/admin/ai-config/fallback', { method: 'POST', body: { order, mockFallback: config.mockFallback } });
    setConfig({ ...config, fallbackOrder: order });
  }

  async function moveDown(idx: number) {
    if (!config || idx >= config.fallbackOrder.length - 1) return;
    const order = [...config.fallbackOrder];
    [order[idx], order[idx + 1]] = [order[idx + 1]!, order[idx]!];
    await apiFetch('/admin/ai-config/fallback', { method: 'POST', body: { order, mockFallback: config.mockFallback } });
    setConfig({ ...config, fallbackOrder: order });
  }

  async function toggleMockFallback() {
    if (!config) return;
    const v = !config.mockFallback;
    await apiFetch('/admin/ai-config/fallback', { method: 'POST', body: { order: config.fallbackOrder, mockFallback: v } });
    setConfig({ ...config, mockFallback: v });
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-gray-100">🤖 IA / LLMs — Multi-Provedor</h1><Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link></div>
      {msg && <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-sm text-cyan-300" onClick={() => setMsg(null)}>{msg}</div>}

      {/* Overview cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {config && Object.entries(config.providers).map(([key, p]) => {
          const meta = PROVIDER_META[key]!;
          return (
            <div key={key} className={`rounded-xl border ${meta.color} p-4 space-y-2`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-200">{meta.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.hasKey ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{p.hasKey ? '✅ Ativo' : '⬜ Off'}</span>
              </div>
              <p className="text-xs text-gray-500">Modelo: <span className="text-gray-300">{p.model}</span></p>
              {p.keyPreview && <p className="text-xs text-gray-500">Chave: <span className="font-mono text-emerald-300">{p.keyPreview}</span> <span className="text-gray-600">({p.keySource})</span></p>}
              <div className="flex gap-2">
                <button onClick={() => selectProvider(key)} className="rounded bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20">{p.hasKey ? 'Editar' : '+ Configurar'}</button>
                {p.hasKey && <button onClick={() => clearKey(key)} className="text-xs text-red-400 hover:underline">Limpar</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Provider form */}
      {tab === 'provider' && (
        <form onSubmit={saveKey} className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="font-semibold text-gray-200">{PROVIDER_META[selProvider]?.name}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gray-500">Modelo</label>
              <select value={selModel} onChange={e => setSelModel(e.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200">
                {PROVIDER_META[selProvider]?.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">API Key</label>
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="sk-..." className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200 font-mono" />
            </div>
          </div>
          <button type="submit" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">Salvar no Redis</button>
        </form>
      )}

      {/* Fallback chain */}
      {config && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-200">🔗 Ordem de Fallback</h2>
          <p className="text-xs text-gray-500">Em caso de falha, o sistema tenta o próximo provider da lista.</p>
          <div className="space-y-1">
            {config.fallbackOrder.map((p, i) => {
              const meta = PROVIDER_META[p];
              const pinfo = config.providers[p];
              return (
                <div key={p} className={`flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 ${!pinfo?.hasKey ? 'opacity-50' : ''}`}>
                  <span className="text-xs text-gray-600 font-mono w-6">#{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-200">{meta?.name ?? p}</span>
                  {!pinfo?.hasKey && <span className="text-xs text-red-400">(sem chave)</span>}
                  <button onClick={() => moveUp(i)} disabled={i === 0} className="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-gray-400 disabled:opacity-30">▲</button>
                  <button onClick={() => moveDown(i)} disabled={i >= config.fallbackOrder.length - 1} className="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-gray-400 disabled:opacity-30">▼</button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <span className="text-xs text-gray-600 font-mono w-6">#∞</span>
            <span className="flex-1 text-sm text-amber-200">🤖 MockAiProvider (fallback final)</span>
            <button onClick={toggleMockFallback} className={`rounded-full px-3 py-0.5 text-xs font-medium transition ${config.mockFallback ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
              {config.mockFallback ? 'Ativo' : 'Desativado'}
            </button>
          </div>
        </div>
      )}

      {/* Usage */}
      {usage && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-200">Consumo de Créditos IA (total)</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-5">
            <Stat label="Interações" value={fmt(usage.interactions)} color="text-cyan-300" />
            <Stat label="Tutor Sensei" value={fmt(usage.tutor)} color="text-emerald-300" />
            <Stat label="Podcast/TTS" value={fmt(usage.podcast)} color="text-amber-300" />
            <Stat label="Ilustrações" value={fmt(usage.illustration)} color="text-purple-300" />
            <Stat label="TOTAL" value={fmt(usage.total)} color="text-gray-100" />
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="rounded-lg border border-white/[0.03] p-3 text-center"><p className={`text-xl font-bold ${color}`}>{value}</p><p className="text-xs text-gray-500">{label}</p></div>;
}
function fmt(n: number) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n); }
