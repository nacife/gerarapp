'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface Stats { totalEndpoints: number; totalDeliveries: number; failedDeliveries: number; pendingDeliveries: number }
interface Delivery { id: string; status: string; statusCode: number | null; createdAt: string; endpoint: { url: string; user: { name: string; email: string } } }

export default function WebhooksAdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [failed, setFailed] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'failed'>('all');

  useEffect(() => {
    Promise.all([
      apiFetch<Stats>('/admin/webhooks/stats'),
      apiFetch<Delivery[]>('/admin/webhooks/deliveries'),
      apiFetch<Delivery[]>('/admin/webhooks/deliveries/failed'),
    ]).then(([s, d, f]) => {
      if (s.status === 401) return router.replace('/entrar');
      if (s.ok && s.data) setStats(s.data);
      if (d.ok && d.data) setDeliveries(d.data);
      if (f.ok && f.data) setFailed(f.data);
      setLoading(false);
    });
  }, [router]);

  async function redeliver(id: string) {
    await apiFetch(`/admin/webhooks/deliveries/${id}/redeliver`, { method: 'POST' });
    const d = await apiFetch<Delivery[]>('/admin/webhooks/deliveries');
    if (d.ok && d.data) setDeliveries(d.data);
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  const list = tab === 'failed' ? failed : deliveries;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-gray-100">Webhooks (Global)</h1><Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link></div>
      {stats && <div className="flex gap-4 text-sm"><span className="text-gray-500">Endpoints: <b className="text-gray-200">{stats.totalEndpoints}</b></span><span className="text-gray-500">Entregas: <b className="text-gray-200">{stats.totalDeliveries}</b></span><span className="text-red-300">Falhas: <b>{stats.failedDeliveries}</b></span><span className="text-amber-300">Pendentes: <b>{stats.pendingDeliveries}</b></span></div>}
      <div className="flex gap-2"><button onClick={() => setTab('all')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'all' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500'}`}>Todas ({deliveries.length})</button><button onClick={() => setTab('failed')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'failed' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500'}`}>Falhas ({failed.length})</button></div>
      <div className="space-y-1">
        {list.map((d) => (
          <div key={d.id} className={`flex items-center justify-between rounded border p-2 text-xs ${d.status === 'failed' ? 'border-red-500/15 bg-red-500/5' : 'border-white/[0.03] bg-white/[0.01]'}`}>
            <div>
              <span className="text-gray-400 truncate max-w-xs inline-block">{d.endpoint.url}</span>
              <span className="ml-2 text-gray-600">{d.endpoint.user.email}</span>
              <span className={`ml-2 font-medium ${d.status === 'succeeded' ? 'text-emerald-300' : d.status === 'failed' ? 'text-red-300' : d.status === 'pending' ? 'text-amber-300' : 'text-gray-500'}`}>{d.status}</span>
              {d.statusCode && <span className="ml-1 text-gray-600">({d.statusCode})</span>}
              <span className="ml-2 text-gray-600">{new Date(d.createdAt).toLocaleString('pt-BR')}</span>
            </div>
            {d.status === 'failed' && <button onClick={() => redeliver(d.id)} className="rounded bg-cyan-500/10 px-2 py-0.5 text-cyan-300 hover:bg-cyan-500/20">Reenviar</button>}
          </div>
        ))}
      </div>
    </main>
  );
}
