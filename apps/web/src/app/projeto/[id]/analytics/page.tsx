'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api';

interface ChapterStat {
  chapterId: string;
  chapterTitle: string;
  pct: number;
}
interface DifficultyRow {
  interactionId: string;
  contentBlockId: string;
  interactionType: string;
  wrongCount: number;
  correctCount: number;
  errorRatePct: number;
}
type Summary =
  | { published: false }
  | {
      published: true;
      sessions: number;
      activeUsers: number;
      totalEnrollments: number;
      completionByChapter: ChapterStat[];
      abandonmentFunnel: ChapterStat[];
    };
type Heatmap = { published: boolean; rows: DifficultyRow[] };

const TYPE_LABEL: Record<string, string> = {
  quiz: 'Quiz',
  flashcard_deck: 'Flashcards',
  cloze: 'Lacunas',
  dragdrop: 'Arrastar',
  timeline: 'Linha do tempo',
  hotspot: 'Hotspots',
  scenario: 'Cenário',
  mindmap: 'Mapa mental',
};

const RANGE_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

function Bar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const qs = `?from=${encodeURIComponent(from)}`;
    setLoaded(false);
    Promise.all([
      apiFetch<Summary>(`/projects/${projectId}/analytics/summary${qs}`),
      apiFetch<Heatmap>(`/projects/${projectId}/analytics/heatmap${qs}`),
    ]).then(([s, h]) => {
      if (s.status === 401) return router.replace('/entrar');
      if (s.ok && s.data) setSummary(s.data);
      if (h.ok && h.data) setHeatmap(h.data);
      setLoaded(true);
    });
  }, [projectId, days, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/painel" className="text-sm text-sky-400 hover:underline">
            ← painel
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Analytics</h1>
        </div>
        <div className="flex gap-1.5">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                days === r.days ? 'bg-sky-500/20 text-sky-300' : 'border border-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {!loaded ? (
        <p className="text-slate-500">Carregando…</p>
      ) : !summary?.published ? (
        <p className="text-sm text-slate-500">Publique o app para começar a coletar dados de analytics.</p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Sessões</p>
              <p className="mt-1 text-2xl font-bold">{summary.sessions}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Usuários ativos</p>
              <p className="mt-1 text-2xl font-bold">{summary.activeUsers}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Matrículas</p>
              <p className="mt-1 text-2xl font-bold">{summary.totalEnrollments}</p>
            </div>
          </section>

          {summary.completionByChapter.length > 0 && (
            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Conclusão por capítulo</h2>
              {summary.completionByChapter.map((c) => (
                <Bar key={c.chapterId} label={c.chapterTitle} pct={c.pct} />
              ))}
            </section>
          )}

          {summary.abandonmentFunnel.length > 0 && (
            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Funil de abandono</h2>
              <p className="text-xs text-slate-500">% de matrículas que alcançaram cada capítulo.</p>
              {summary.abandonmentFunnel.map((c) => (
                <Bar key={c.chapterId} label={c.chapterTitle} pct={c.pct} />
              ))}
            </section>
          )}

          {heatmap && heatmap.rows.length > 0 && (
            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Mapa de dificuldade</h2>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'}/v1/projects/${projectId}/analytics/heatmap.csv?from=${encodeURIComponent(new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())}`}
                  className="text-xs text-sky-400 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  baixar CSV
                </a>
              </div>
              <div className="space-y-1.5">
                {heatmap.rows.slice(0, 10).map((r) => (
                  <div
                    key={r.interactionId}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-300">{TYPE_LABEL[r.interactionType] ?? r.interactionType}</span>
                    <span className={`text-xs ${r.errorRatePct >= 50 ? 'text-rose-400' : 'text-slate-500'}`}>
                      {r.errorRatePct}% de erro ({r.wrongCount}/{r.wrongCount + r.correctCount})
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
