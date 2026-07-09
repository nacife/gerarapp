'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api';

type Colors = Record<string, string>;
interface Project {
  id: string;
  slug: string;
  title: string;
  status: string;
  accessMode: string;
  createdAt: string;
}
interface Theme {
  templateKey: string;
  palette: { light: Colors; dark: Colors };
}
interface Interaction {
  id: string;
  contentBlockId: string | null;
  type: string;
}
interface Version {
  id: string;
  versionNumber: number;
  bundleSha512: string | null;
  active: boolean;
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

const ACCESS_LABEL: Record<string, string> = {
  public: 'Público',
  link: 'Link secreto',
  password: 'Protegido por senha',
};

export default function RevisarPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [publishInfo, setPublishInfo] = useState<{ url: string; bundleSha512: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadAll() {
    const [proj, th, ints, vers] = await Promise.all([
      apiFetch<Project>(`/projects/${projectId}`),
      apiFetch<Theme>(`/projects/${projectId}/theme`),
      apiFetch<Interaction[]>(`/projects/${projectId}/interactions`),
      apiFetch<Version[]>(`/projects/${projectId}/versions`),
    ]);
    if (proj.status === 401) return router.replace('/entrar');
    if (proj.ok && proj.data) setProject(proj.data);
    if (th.ok && th.data) setTheme(th.data);
    if (ints.ok && ints.data) setInteractions(ints.data);
    if (vers.ok && vers.data) setVersions(vers.data);
    setLoaded(true);
  }

  useEffect(() => {
    void loadAll();
  }, [projectId]);

  async function publish() {
    setBusy(true);
    setMsg(null);
    const res = await apiFetch<{ url: string; bundleSha512: string; versionNumber: number }>(
      `/projects/${projectId}/publish`,
      { method: 'POST' },
    );
    setBusy(false);
    if (res.ok && res.data) {
      setPublishInfo({ url: res.data.url, bundleSha512: res.data.bundleSha512 });
      setMsg(`Publicado como versão ${res.data.versionNumber}.`);
      await loadAll();
    } else {
      setMsg(res.problem?.detail ?? 'Falha ao publicar.');
    }
  }

  async function rollback(n: number) {
    await apiFetch(`/projects/${projectId}/rollback`, { method: 'POST', body: { versionNumber: n } });
    await loadAll();
  }

  const sections = new Set(interactions.map((i) => i.contentBlockId)).size;
  const byType = interactions.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});
  const c = theme ? theme.palette.light : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <header>
        <p className="text-xs uppercase tracking-wider text-slate-500">
          ①Upload — ②Mapa — ③Visual — ④Interações — <span className="text-sky-400">⑤Revisão</span>
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Revisão e publicação</h1>
        <Link href={`/projeto/${projectId}/interacoes`} className="text-sm text-sky-400 hover:underline">
          ← interações
        </Link>
      </header>

      {!loaded ? (
        <p className="text-slate-500">Carregando…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">Resumo</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Título</dt>
                  <dd className="font-medium">{project?.title}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Seções com interações</dt>
                  <dd>{sections}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Total de interações</dt>
                  <dd>{interactions.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Acesso</dt>
                  <dd>{project ? (ACCESS_LABEL[project.accessMode] ?? project.accessMode) : '—'}</dd>
                </div>
              </dl>
              {interactions.length === 0 && (
                <p className="mt-3 text-xs text-amber-300">
                  ⚠ Nenhuma interação gerada ainda. Volte ao passo ④ antes de publicar.
                </p>
              )}
              {Object.keys(byType).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(byType).map(([type, n]) => (
                    <span
                      key={type}
                      className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                    >
                      {TYPE_LABEL[type] ?? type} × {n}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {versions.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-slate-500">Versões</h2>
                <div className="space-y-2">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm"
                    >
                      <span>
                        v{v.versionNumber} {v.active && <span className="text-emerald-400">· ativa</span>}
                      </span>
                      {!v.active && (
                        <button
                          onClick={() => rollback(v.versionNumber)}
                          className="text-xs text-sky-400 hover:underline"
                        >
                          Reverter para esta
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {versions.length > 0 && (
              <Link
                href={`/projeto/${projectId}/inpi`}
                className="block rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition hover:border-slate-600"
              >
                <p className="font-semibold">📜 Registro INPI</p>
                <p className="mt-1 text-xs text-slate-500">
                  Gere o pacote de código-fonte, o hash SHA-512 e a Declaração de Integridade para o registro
                  no INPI →
                </p>
              </Link>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Prévia final</h2>
            {c && (
              <div
                className="rounded-2xl border p-5"
                style={{ background: c.bg, color: c.text, borderColor: c.border }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-lg font-black"
                    style={{ background: c.primary, color: c.bg }}
                  >
                    {project?.title?.[0]?.toUpperCase() ?? 'E'}
                  </span>
                  <strong>{project?.title}</strong>
                </div>
                <p className="mt-3 text-sm" style={{ color: c.muted }}>
                  {interactions.length} interações em {sections} seções, prontas para publicar.
                </p>
              </div>
            )}

            <button
              onClick={publish}
              disabled={busy || interactions.length === 0}
              className="w-full rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Publicando…' : 'Publicar app 🚀'}
            </button>
            {msg && <p className="text-sm text-slate-400">{msg}</p>}
            {publishInfo && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                <a href={publishInfo.url} target="_blank" rel="noreferrer" className="text-sky-300 underline">
                  {publishInfo.url}
                </a>
                <p className="mt-1 break-all text-xs text-slate-500">
                  SHA-512: {publishInfo.bundleSha512.slice(0, 32)}…
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
