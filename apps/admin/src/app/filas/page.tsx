'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

type QueueStats = { waiting: number; active: number; failed: number; completed: number; delayed: number };
type QueueMap = Record<string, QueueStats>;

const LABELS: Record<string, string> = {
  ingest: 'Ingestão', generate: 'Geração IA', tts: 'Podcast/TTS',
  'inpi-package': 'Pacote INPI', 'sensei-embed': 'Indexação Sensei', 'webhook-delivery': 'Webhooks',
};

export default function FilasPage() {
  const router = useRouter();
  const [queues, setQueues] = useState<QueueMap>({});
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, [router]);

  async function load() {
    const res = await apiFetch<QueueMap>('/admin/queues');
    if (res.status === 401) return router.replace('/entrar');
    if (res.ok && res.data) setQueues(res.data);
    setLoading(false);
  }

  async function retryAll(name: string) {
    const res = await apiFetch(`/admin/queues/${name}/retry-all`, { method: 'POST' });
    setActionMsg(res.ok ? `${name}: jobs reenfileirados` : 'Falha');
    setTimeout(() => setActionMsg(null), 3000);
    setTimeout(load, 1000);
  }

  async function cleanCompleted(name: string) {
    const res = await apiFetch(`/admin/queues/${name}/clean`, { method: 'POST' });
    setActionMsg(res.ok ? `${name}: limpo` : 'Falha');
    setTimeout(() => setActionMsg(null), 3000);
    setTimeout(load, 1000);
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  const totalWaiting = Object.values(queues).reduce((s, q) => s + q.waiting, 0);
  const totalActive = Object.values(queues).reduce((s, q) => s + q.active, 0);
  const totalFailed = Object.values(queues).reduce((s, q) => s + q.failed, 0);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Monitor de Filas BullMQ</h1>
        <Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link>
      </div>

      <div className="flex gap-3 text-sm">
        <span className="text-gray-500">⏳ Aguardando: <b className="text-gray-200">{totalWaiting}</b></span>
        <span className="text-cyan-300">▶ Ativos: <b>{totalActive}</b></span>
        <span className="text-red-300">✕ Falhas: <b>{totalFailed}</b></span>
      </div>

      {actionMsg && <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-sm text-cyan-300">{actionMsg}</div>}

      <div className="space-y-3">
        {Object.entries(queues).map(([name, stats]) => (
          <div key={name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-200">{LABELS[name] ?? name}</h3>
              <div className="flex gap-2">
                {stats.failed > 0 && <button onClick={() => retryAll(name)} className="rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/25">↻ Retry all ({stats.failed})</button>}
                {stats.completed > 0 && <button onClick={() => cleanCompleted(name)} className="rounded bg-white/[0.04] px-2 py-1 text-xs text-gray-500 hover:text-gray-300">Limpar concluídos ({stats.completed})</button>}
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <Bar label="⏳ Wait" value={stats.waiting} color="bg-gray-500" total={stats.waiting + stats.active + stats.failed + stats.completed || 1} />
              <Bar label="▶ Active" value={stats.active} color="bg-cyan-500" total={stats.waiting + stats.active + stats.failed + stats.completed || 1} />
              <Bar label="✕ Failed" value={stats.failed} color="bg-red-500" total={stats.waiting + stats.active + stats.failed + stats.completed || 1} />
              <Bar label="✓ Done" value={stats.completed} color="bg-emerald-500" total={stats.waiting + stats.active + stats.failed + stats.completed || 1} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Bar({ label, value, color, total }: { label: string; value: number; color: string; total: number }) {
  const pct = Math.round((value / total) * 100);
  return <div className="flex-1">
    <span className="text-xs text-gray-500">{label}: {value}</span>
    <div className="mt-1 h-2 rounded-full bg-white/[0.04]"><div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
  </div>;
}
