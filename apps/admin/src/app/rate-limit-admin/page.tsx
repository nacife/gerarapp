'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

export default function RateLimitAdminPage() {
  const router = useRouter();
  const [config, setConfig] = useState({ maxRequestsPerMinute: 60, windowSeconds: 60, blocklistSize: 0 });
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [maxReq, setMaxReq] = useState(60);
  const [windowSec, setWindowSec] = useState(60);
  const [ip, setIp] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [router]);
  async function load() {
    const [cRes, bRes] = await Promise.all([apiFetch<any>('/admin/rate-limit/config'), apiFetch<any>('/admin/rate-limit/blocklist')]);
    if (cRes.status === 401) return router.replace('/entrar');
    if (cRes.ok && cRes.data) { setConfig(cRes.data); setMaxReq(cRes.data.maxRequestsPerMinute); setWindowSec(cRes.data.windowSeconds); }
    if (bRes.ok && bRes.data) setBlocklist(bRes.data.ips || []);
    setLoading(false);
  }

  async function saveConfig(e: FormEvent) { e.preventDefault();
    await apiFetch('/admin/rate-limit/config', { method: 'POST', body: { maxRequestsPerMinute: maxReq, windowSeconds: windowSec } });
    load();
  }

  async function blockIp(e: FormEvent) { e.preventDefault();
    await apiFetch('/admin/rate-limit/blocklist', { method: 'POST', body: { ip } });
    setIp(''); load();
  }

  async function clearBlocklist() { await apiFetch('/admin/rate-limit/blocklist/clear', { method: 'POST' }); load(); }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-gray-100">Rate Limiting</h1><Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link></div>

      <form onSubmit={saveConfig} className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div><label className="text-xs text-gray-500">Requisições/min</label><input type="number" value={maxReq} onChange={e => setMaxReq(+e.target.value)} className="w-24 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" /></div>
        <div><label className="text-xs text-gray-500">Janela (seg)</label><input type="number" value={windowSec} onChange={e => setWindowSec(+e.target.value)} className="w-24 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" /></div>
        <button type="submit" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">Salvar</button>
        <span className="text-xs text-gray-600">Atual: {config.maxRequestsPerMinute} req/{config.windowSeconds}s · {config.blocklistSize} IPs bloqueados</span>
      </form>

      <form onSubmit={blockIp} className="flex items-end gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex-1"><label className="text-xs text-gray-500">IP para bloqueio</label><input value={ip} onChange={e => setIp(e.target.value)} placeholder="192.168.1.1" className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" /></div>
        <button type="submit" className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300">Bloquear IP</button>
        {blocklist.length > 0 && <button type="button" onClick={clearBlocklist} className="rounded-lg bg-white/[0.04] px-4 py-2 text-sm text-gray-500">Limpar lista ({blocklist.length})</button>}
      </form>

      {blocklist.length > 0 && <div className="space-y-1">{blocklist.map((ip, i) => <div key={i} className="rounded border border-red-500/10 bg-red-500/5 p-2 text-xs text-red-300 font-mono">{ip}</div>)}</div>}
    </main>
  );
}
