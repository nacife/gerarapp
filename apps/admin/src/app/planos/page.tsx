'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface Plan { id: string; key: string; name: string; priceCentsMonth: number; minTier: number; limits: Record<string, number> }

export default function PlanosPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [tier, setTier] = useState(0);
  const [limits, setLimits] = useState({ projects: 3, storageMb: 100, learnersPerProject: 50, aiCreditsMonthly: 100 });

  useEffect(() => { load(); }, [router]);

  async function load() {
    const res = await apiFetch<Plan[]>('/admin/plans');
    if (res.status === 401) return router.replace('/entrar');
    if (res.ok && res.data) setPlans(res.data);
    setLoading(false);
  }

  function resetForm() { setKey(''); setName(''); setPrice(0); setTier(0); setLimits({ projects: 3, storageMb: 100, learnersPerProject: 50, aiCreditsMonthly: 100 }); setEditingId(null); setShowForm(false); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { key, name, priceCentsMonth: price, minTier: tier, limits };
    const res = editingId
      ? await apiFetch(`/admin/plans/${editingId}`, { method: 'PUT', body })
      : await apiFetch('/admin/plans', { method: 'POST', body });
    if (res.ok) { resetForm(); load(); }
  }

  function edit(p: Plan) {
    setEditingId(p.id); setKey(p.key); setName(p.name); setPrice(p.priceCentsMonth); setTier(p.minTier);
    setLimits((p.limits || {}) as any); setShowForm(true);
  }

  async function del(id: string) { await apiFetch(`/admin/plans/${id}`, { method: 'DELETE' }); load(); }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Planos</h1>
        <Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link>
      </div>
      <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">{showForm ? 'Cancelar' : '+ Novo plano'}</button>

      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={key} onChange={e => setKey(e.target.value)} placeholder="Key" className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" required />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" required />
            <input type="number" value={price} onChange={e => setPrice(+e.target.value)} placeholder="Preço (cents)" className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" />
            <input type="number" value={tier} onChange={e => setTier(+e.target.value)} placeholder="Tier (0=free, 1=pro, 2=business)" className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" />
            <input type="number" value={limits.projects} onChange={e => setLimits({ ...limits, projects: +e.target.value })} placeholder="Máx. projetos" className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" />
            <input type="number" value={limits.storageMb} onChange={e => setLimits({ ...limits, storageMb: +e.target.value })} placeholder="Storage MB" className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" />
            <input type="number" value={limits.learnersPerProject} onChange={e => setLimits({ ...limits, learnersPerProject: +e.target.value })} placeholder="Aprendizes/projeto" className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" />
            <input type="number" value={limits.aiCreditsMonthly} onChange={e => setLimits({ ...limits, aiCreditsMonthly: +e.target.value })} placeholder="Créditos IA/mês" className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" />
          </div>
          <button type="submit" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">{editingId ? 'Atualizar' : 'Criar'}</button>
        </form>
      )}

      <div className="space-y-2">
        {plans.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] p-4">
            <div>
              <p className="font-semibold text-gray-200">{p.name} <span className="text-xs text-gray-500">({p.key})</span></p>
              <p className="text-xs text-gray-500">Tier {p.minTier} · R$ {(p.priceCentsMonth / 100).toFixed(2)}/mês · {(p.limits as any)?.projects ?? '?'} projetos · {(p.limits as any)?.aiCreditsMonthly ?? '?'} créd.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => edit(p)} className="text-xs text-cyan-400 hover:underline">Editar</button>
              <button onClick={() => del(p.id)} className="text-xs text-red-400 hover:underline">Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
