'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface AiConfig { provider: string; models: Record<string, string>; keys: Record<string, string | null>; keysSource: Record<string, string>; note: string }
interface AiUsage { interactions: number; tutor: number; podcast: number; illustration: number; total: number }

const PROVIDERS = [
  { key: 'anthropic', name: 'Anthropic (Claude)', env: 'ANTHROPIC_API_KEY' },
  { key: 'openai', name: 'OpenAI (GPT-4o)', env: 'OPENAI_API_KEY' },
  { key: 'google', name: 'Google (Gemini)', env: 'GOOGLE_API_KEY' },
];

export default function AiConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<AiConfig>('/admin/ai-config'),
      apiFetch<AiUsage>('/admin/ai-config/usage'),
    ]).then(([c, u]) => {
      if (c.status === 401) return router.replace('/entrar');
      if (c.ok && c.data) setConfig(c.data);
      if (u.ok && u.data) setUsage(u.data);
      setLoading(false);
    });
  }, [router]);

  async function saveKey(e: FormEvent) { e.preventDefault();
    const res = await apiFetch('/admin/ai-config/key', { method: 'POST', body: { provider, apiKey } });
    setMsg(res.ok ? `${provider}: chave salva no Redis ✅` : 'Erro ao salvar');
    setApiKey('');
    const c = await apiFetch<AiConfig>('/admin/ai-config');
    if (c.ok && c.data) setConfig(c.data);
  }

  async function clearKey(p: string) {
    await apiFetch('/admin/ai-config/key/clear', { method: 'POST', body: { provider: p } });
    const c = await apiFetch<AiConfig>('/admin/ai-config');
    if (c.ok && c.data) setConfig(c.data);
    setMsg(`${p}: chave removida do Redis`);
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-gray-100">🤖 Configuração de IA / LLMs</h1><Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link></div>
      {msg && <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-sm text-cyan-300">{msg}</div>}

      {/* Status atual */}
      {config && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-200">Status Atual</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div><span className="text-gray-500">Provider ativo: </span><span className="text-cyan-300 font-bold">{config.provider}</span></div>
            <div><span className="text-gray-500">Modelo Structure: </span><span className="text-gray-200">{config.models.structure}</span></div>
            <div><span className="text-gray-500">Modelo Interactions: </span><span className="text-gray-200">{config.models.interactions}</span></div>
            <div><span className="text-gray-500">Modelo Tutor: </span><span className="text-gray-200">{config.models.tutor}</span></div>
          </div>
          <p className="text-xs text-gray-600">{config.note}</p>
        </div>
      )}

      {/* Chaves por provider */}
      <div className="grid gap-4 lg:grid-cols-3">
        {PROVIDERS.map((p) => (
          <div key={p.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
            <h3 className="font-semibold text-gray-200">{p.name}</h3>
            <p className="text-xs text-gray-500">Env: {p.env}</p>
            <p className="text-sm">
              <span className="text-gray-500">Chave: </span>
              {config?.keys[p.key] ? (
                <span className="font-mono text-emerald-300">{config.keys[p.key]}</span>
              ) : (
                <span className="text-red-400">Não configurada</span>
              )}
              {config?.keysSource[p.key] && (
                <span className={`ml-1 rounded px-1.5 py-0.5 text-xs font-medium ${config.keysSource[p.key] === 'redis' ? 'bg-amber-500/10 text-amber-300' : 'bg-gray-500/10 text-gray-400'}`}>
                  {config.keysSource[p.key] === 'redis' ? 'Redis' : config.keysSource[p.key] === 'env' ? '.env' : 'off'}
                </span>
              )}
            </p>
            {config?.keys[p.key] && (
              <button onClick={() => clearKey(p.key)} className="text-xs text-red-400 hover:underline">Remover do Redis</button>
            )}
          </div>
        ))}
      </div>

      {/* Formulário para salvar chave no Redis */}
      <form onSubmit={saveKey} className="flex items-end gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div>
          <label className="text-xs text-gray-500">Provider</label>
          <select value={provider} onChange={e => setProvider(e.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200">
            {PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500">API Key</label>
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="sk-..." className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200 font-mono" />
        </div>
        <button type="submit" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">Salvar no Redis</button>
      </form>
      <p className="text-xs text-gray-600">As chaves salvas no Redis têm precedência sobre o .env e permitem trocar a chave sem reiniciar a API.</p>

      {/* Uso de créditos */}
      {usage && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-200">Consumo de Créditos IA (total)</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-5">
            <Stat label="Interações" value={fmt(usage.interactions)} color="text-cyan-300" />
            <Stat label="Tutor Sensei" value={fmt(usage.tutor)} color="text-emerald-300" />
            <Stat label="Podcast/TTS" value={fmt(usage.podcast)} color="text-amber-300" />
            <Stat label="Ilustrações" value={fmt(usage.illustration)} color="text-purple-300" />
            <Stat label="TOTAL" value={fmt(usage.total)} color="text-gray-100 font-bold" />
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
