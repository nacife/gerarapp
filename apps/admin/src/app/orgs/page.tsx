'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface Org { id: string; name: string; slug: string; planKey: string; createdAt: string; _count: { members: number; projects: number } }
interface OrgDetail extends Org { members: { user: { id: string; name: string; email: string; role: string } }[]; projects: { id: string; title: string; slug: string }[] }

export default function OrgsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [planKey, setPlanKey] = useState('free');
  const [addUserId, setAddUserId] = useState('');

  useEffect(() => { loadOrgs(); }, [router]);
  async function loadOrgs() {
    const res = await apiFetch<Org[]>('/admin/orgs');
    if (res.status === 401) return router.replace('/entrar');
    if (res.ok && res.data) setOrgs(res.data);
    setLoading(false);
  }

  async function viewDetail(id: string) {
    const res = await apiFetch<OrgDetail>(`/admin/orgs/${id}`);
    if (res.ok && res.data) setDetail(res.data);
  }

  async function createOrg(e: FormEvent) { e.preventDefault();
    await apiFetch('/admin/orgs', { method: 'POST', body: { name, slug, planKey } });
    setShowForm(false); loadOrgs();
  }

  async function deleteOrg(id: string) { await apiFetch(`/admin/orgs/${id}`, { method: 'DELETE' }); loadOrgs(); setDetail(null); }

  async function addMember() {
    if (!detail || !addUserId) return;
    await apiFetch(`/admin/orgs/${detail.id}/members`, { method: 'POST', body: { userId: addUserId, role: 'creator' } });
    setAddUserId(''); viewDetail(detail.id);
  }

  async function removeMember(orgId: string, userId: string) {
    await apiFetch(`/admin/orgs/${orgId}/members/${userId}`, { method: 'DELETE' });
    viewDetail(orgId);
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Organizações</h1>
        <Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link>
      </div>

      <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">{showForm ? 'Cancelar' : '+ Nova organização'}</button>
      {showForm && (
        <form onSubmit={createOrg} className="flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" required />
          <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="Slug" className="w-40 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" required />
          <select value={planKey} onChange={e => setPlanKey(e.target.value)} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200"><option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option></select>
          <button type="submit" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">Criar</button>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {orgs.map((o) => (<button key={o.id} onClick={() => viewDetail(o.id)} className={`w-full rounded-lg border p-3 text-left transition ${detail?.id === o.id ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08]'}`}><p className="text-sm font-medium text-gray-200">{o.name} <span className="text-xs text-gray-500">({o.slug})</span></p><p className="text-xs text-gray-500">Tier {o.planKey} · {o._count.members} membros · {o._count.projects} projetos</p></button>))}
        </div>

        <div>
          {detail && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-200">{detail.name}</h2><button onClick={() => deleteOrg(detail.id)} className="text-xs text-red-400 hover:underline">Excluir org</button></div>
              <p className="text-xs text-gray-500">Slug: {detail.slug} · Plano: {detail.planKey} · Criada: {new Date(detail.createdAt).toLocaleDateString('pt-BR')}</p>

              <h3 className="text-sm font-medium text-gray-300">Membros ({detail.members.length})</h3>
              <div className="space-y-1">
                {detail.members.map((m) => (<div key={m.user.id} className="flex items-center justify-between rounded border border-white/[0.03] p-2 text-sm"><span className="text-gray-300">{m.user.name} <span className="text-gray-500">({m.user.email})</span> <span className="text-xs text-gray-600">[{m.user.role}]</span></span><button onClick={() => removeMember(detail.id, m.user.id)} className="text-xs text-red-400 hover:underline">Remover</button></div>))}
              </div>

              <div className="flex gap-2">
                <input value={addUserId} onChange={e => setAddUserId(e.target.value)} placeholder="UUID do usuário" className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-gray-200" />
                <button onClick={addMember} className="rounded bg-cyan-500/20 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-500/30">Adicionar</button>
              </div>

              <h3 className="text-sm font-medium text-gray-300">Projetos ({detail.projects.length})</h3>
              <div className="space-y-1">{detail.projects.map((p) => (<div key={p.id} className="text-xs text-gray-400">{p.title} ({p.slug})</div>))}</div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
