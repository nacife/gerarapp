'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api';

interface Interaction {
  id: string;
  contentBlockId: string | null;
  type: string;
  payload: any;
  difficulty: string;
  origin: string;
  position: number;
}

const TYPE_LABEL: Record<string, string> = {
  quiz: 'Quiz',
  flashcard_deck: 'Flashcards',
  cloze: 'Lacunas',
  dragdrop: 'Arrastar',
  timeline: 'Linha do tempo',
  hotspot: 'Hotspots',
  scenario: 'Cenário',
  audio: 'Áudio',
  mindmap: 'Mapa mental',
};
const TYPE_COLOR: Record<string, string> = {
  quiz: 'bg-sky-500/20 text-sky-300',
  flashcard_deck: 'bg-fuchsia-500/20 text-fuchsia-300',
  cloze: 'bg-amber-500/20 text-amber-300',
  dragdrop: 'bg-emerald-500/20 text-emerald-300',
  timeline: 'bg-indigo-500/20 text-indigo-300',
  mindmap: 'bg-rose-500/20 text-rose-300',
};

function preview(it: Interaction): string {
  const p = it.payload ?? {};
  switch (it.type) {
    case 'quiz':
      return p.question_md ?? '';
    case 'flashcard_deck':
      return `${p.cards?.length ?? 0} cartões · ${p.cards?.[0]?.front_md ?? ''}`;
    case 'cloze':
      return p.text_template_md ?? '';
    case 'dragdrop':
      return `${p.variant}: ${p.prompt_md ?? ''}`;
    case 'timeline':
      return `${p.title_md ?? ''} (${p.events?.length ?? 0} eventos)`;
    case 'mindmap':
      return `${p.nodes?.length ?? 0} nós`;
    default:
      return it.type;
  }
}

export default function InteracoesPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const [items, setItems] = useState<Interaction[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [density, setDensity] = useState('balanced');
  const [status, setStatus] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const [list, bal] = await Promise.all([
      apiFetch<Interaction[]>(`/projects/${projectId}/interactions`),
      apiFetch<{ balance: number }>('/credits/balance'),
    ]);
    if (list.status === 401) return router.replace('/entrar');
    if (list.ok && list.data) setItems(list.data);
    if (bal.ok && bal.data) setBalance(bal.data.balance);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  async function generate() {
    setWorking(true);
    setStatus('Enfileirando…');
    const res = await apiFetch<{ jobId: string }>(`/projects/${projectId}/interactions/generate`, {
      method: 'POST',
      body: { density },
    });
    if (!res.ok || !res.data) {
      setStatus(res.problem?.detail ?? 'Falha ao gerar.');
      setWorking(false);
      return;
    }
    const jobId = res.data.jobId;
    for (let i = 0; i < 120; i++) {
      const job = await apiFetch<{ status: string; progress?: { steps?: { pct: number }[] } }>(
        `/jobs/${jobId}`,
      );
      const pct = job.data?.progress?.steps?.[0]?.pct ?? 0;
      setStatus(`Gerando… ${pct}%`);
      if (job.data?.status === 'succeeded') break;
      if (job.data?.status === 'failed') {
        setStatus('Falha na geração.');
        setWorking(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    setStatus(null);
    setWorking(false);
    await load();
  }

  async function regenerate(id: string) {
    const res = await apiFetch<Interaction>(`/interactions/${id}/regenerate`, { method: 'POST' });
    if (res.ok && res.data) setItems((xs) => xs.map((x) => (x.id === id ? res.data! : x)));
  }
  async function remove(id: string) {
    const res = await apiFetch(`/interactions/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((xs) => xs.filter((x) => x.id !== id));
  }

  const groups = Array.from(new Set(items.map((i) => i.contentBlockId)));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            ①Upload — ②Mapa — ③Visual — <span className="text-sky-400">④Interações</span> — ⑤Revisão
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Interações</h1>
          <div className="flex gap-3 text-sm">
            <Link href={`/projeto/${projectId}/visual`} className="text-sky-400 hover:underline">
              ← visual
            </Link>
            <Link href={`/projeto/${projectId}/revisar`} className="text-sky-400 hover:underline">
              revisar e publicar →
            </Link>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-slate-500">Créditos de IA</p>
          <p className="text-lg font-semibold">{balance ?? '—'}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <span className="text-sm text-slate-400">Densidade</span>
        <select
          value={density}
          onChange={(e) => setDensity(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
        >
          <option value="light">Leve (1–2)</option>
          <option value="balanced">Equilibrado (2–4)</option>
          <option value="intensive">Intensivo (4–6)</option>
        </select>
        <button
          onClick={generate}
          disabled={working}
          className="rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
        >
          {working ? (status ?? 'Gerando…') : items.length ? 'Regerar tudo' : 'Gerar interações'}
        </button>
        {status && !working && <span className="text-sm text-rose-400">{status}</span>}
      </div>

      {!loaded ? (
        <p className="text-slate-500">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhuma interação ainda. Aprove o mapa e clique em “Gerar interações”.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((blockId, gi) => (
            <section key={blockId ?? gi}>
              <h2 className="mb-2 text-xs uppercase tracking-wider text-slate-500">Seção {gi + 1}</h2>
              <div className="space-y-2">
                {items
                  .filter((it) => it.contentBlockId === blockId)
                  .map((it) => (
                    <div
                      key={it.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3"
                    >
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${TYPE_COLOR[it.type] ?? 'bg-slate-800 text-slate-400'}`}
                          >
                            {TYPE_LABEL[it.type] ?? it.type}
                          </span>
                          <span className="text-xs text-slate-600">{it.difficulty}</span>
                          {it.origin === 'ai_edited' && (
                            <span className="text-xs text-amber-400">editado</span>
                          )}
                        </div>
                        <p className="truncate text-sm text-slate-300">{preview(it)}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => regenerate(it.id)}
                          title="Regenerar"
                          className="rounded-md border border-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-slate-600"
                        >
                          ⟳
                        </button>
                        <button
                          onClick={() => remove(it.id)}
                          title="Excluir"
                          className="rounded-md border border-slate-800 px-2 py-1 text-xs text-rose-300 hover:border-rose-500/50"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
