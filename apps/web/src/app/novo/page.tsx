'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

const MAX_BYTES = 200 * 1024 * 1024;
const ACCEPTED = ['pdf', 'epub', 'docx', 'md'];

interface Step {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done';
  pct: number;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function NovoPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<'form' | 'working' | 'error'>('form');
  const [label, setLabel] = useState('Enviando…');
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File | null) {
    setError(null);
    if (!f) return setFile(null);
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPTED.includes(ext)) {
      setError('Formatos aceitos: PDF, EPUB, DOCX, Markdown.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('Limite de 200 MB por arquivo.');
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }

  async function start(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setPhase('working');
    setLabel('Preparando upload…');

    const sha = await sha256Hex(await file.arrayBuffer());

    const proj = await apiFetch<{ id: string }>('/projects', {
      method: 'POST',
      body: { title: title || file.name },
    });
    if (!proj.ok || !proj.data) return fail(proj.problem?.detail);
    const pid = proj.data.id;

    const init = await apiFetch<{ fileId: string; uploadUrl: string }>(
      `/projects/${pid}/source-files`,
      {
        method: 'POST',
        body: { filename: file.name, contentType: file.type || undefined, sizeBytes: file.size, sha256: sha },
      },
    );
    if (!init.ok || !init.data) return fail(init.problem?.detail);

    setLabel('Enviando arquivo…');
    const put = await fetch(init.data.uploadUrl, { method: 'PUT', body: file });
    if (!put.ok) return fail(`Falha no upload (HTTP ${put.status}).`);

    setLabel('Processando…');
    const ing = await apiFetch<{ jobId: string }>(`/source-files/${init.data.fileId}/ingest`, {
      method: 'POST',
    });
    if (!ing.ok || !ing.data) return fail(ing.problem?.detail);
    const jobId = ing.data.jobId;

    for (let i = 0; i < 200; i++) {
      const job = await apiFetch<{
        status: string;
        error?: string;
        progress?: { steps: Step[] };
      }>(`/jobs/${jobId}`);
      if (job.data?.progress?.steps) setSteps(job.data.progress.steps);
      if (job.data?.status === 'succeeded') {
        router.push(`/projeto/${pid}/mapa`);
        return;
      }
      if (job.data?.status === 'failed') return fail(job.data.error ?? 'Falha na ingestão.');
      await new Promise((r) => setTimeout(r, 1200));
    }
    fail('Tempo esgotado no processamento.');
  }

  function fail(detail?: string) {
    setError(detail ?? 'Algo deu errado.');
    setPhase('error');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-6 py-16">
      <Link href="/painel" className="text-sm text-slate-400 hover:text-white">
        ← Voltar
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Novo app a partir de arquivo</h1>
        <p className="mt-2 text-slate-400">Envie um PDF, EPUB, DOCX ou Markdown (até 200 MB).</p>
      </div>

      {phase === 'working' ? (
        <div className="space-y-4">
          <p className="text-slate-300">{label}</p>
          <div className="space-y-3">
            {(steps.length
              ? steps
              : [
                  { key: 'extract', label: 'Extraindo', status: 'running', pct: 0 },
                  { key: 'structure', label: 'Estruturando', status: 'pending', pct: 0 },
                  { key: 'classify', label: 'Classificando', status: 'pending', pct: 0 },
                ]
            ).map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <span
                  className={
                    s.status === 'done'
                      ? 'text-emerald-400'
                      : s.status === 'running'
                        ? 'text-sky-400'
                        : 'text-slate-600'
                  }
                >
                  {s.status === 'done' ? '✓' : s.status === 'running' ? '◐' : '○'}
                </span>
                <span className="w-32 text-sm">{s.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-fuchsia-500 transition-all"
                    style={{ width: `${s.status === 'done' ? 100 : s.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={start} className="space-y-5">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center transition hover:border-sky-500/50">
            <span className="text-3xl">📄</span>
            <span className="font-medium">{file ? file.name : 'Escolher arquivo'}</span>
            <span className="text-xs text-slate-500">PDF, EPUB, DOCX, Markdown</span>
            <input
              type="file"
              accept=".pdf,.epub,.docx,.md"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-400">Título do app</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-500"
            />
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            disabled={!file}
            className="w-full rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 px-5 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-40"
          >
            Enviar e processar
          </button>
        </form>
      )}

      {phase === 'error' && error && (
        <button onClick={() => setPhase('form')} className="text-sm text-sky-400 hover:underline">
          Tentar novamente
        </button>
      )}
    </main>
  );
}
