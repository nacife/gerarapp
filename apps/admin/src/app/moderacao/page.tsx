'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface ModCase { id: string; project: { title: string; slug: string }; source: string; status: string; createdAt: string; assignee?: { name: string } }

const STATUS: Record<string, string> = { open: 'Aberto', reviewing: 'Em revisão', resolved: 'Resolvido', takedown: 'Removido' };
const SOURCE: Record<string, string> = { classifier: '🤖 Classificador', report: '🚩 Denúncia', dmca: '⚖️ DMCA' };

export default function ModeracaoPage() {
  const router = useRouter();
  const [cases, setCases] = useState<ModCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [router]);
  async function load() {
    const res = await apiFetch<ModCase[]>('/admin/moderation/cases');
    if (res.status === 401) return router.replace('/entrar');
    if (res.ok && res.data) setCases(res.data);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    await apiFetch(`/admin/moderation/cases/${id}`, { method: 'PATCH', body: { status } });
    load();
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Moderação de Conteúdo</h1>
        <Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link>
      </div>
      <p className="text-sm text-gray-500">{cases.length} casos encontrados.</p>
      <div className="space-y-2">
        {cases.map((c) => (
          <div key={c.id} className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">{SOURCE[c.source] ?? c.source}: {c.project.title}</p>
                <p className="text-xs text-gray-500">{c.project.slug} · {new Date(c.createdAt).toLocaleDateString('pt-BR')} {c.assignee && `· ${c.assignee.name}`}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${c.status === 'open' ? 'bg-red-500/10 text-red-300' : c.status === 'reviewing' ? 'bg-amber-500/10 text-amber-300' : c.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-500/10 text-gray-400'}`}>{STATUS[c.status] ?? c.status}</span>
                {c.status === 'open' && <button onClick={() => updateStatus(c.id, 'reviewing')} className="rounded bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20">Revisar</button>}
                {c.status === 'reviewing' && <><button onClick={() => updateStatus(c.id, 'resolved')} className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">Resolver</button><button onClick={() => updateStatus(c.id, 'takedown')} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20">Takedown</button></>}
              </div>
            </div>
          </div>
        ))}
        {cases.length === 0 && <p className="text-center text-gray-500 py-8">Nenhum caso de moderação.</p>}
      </div>
    </main>
  );
}
