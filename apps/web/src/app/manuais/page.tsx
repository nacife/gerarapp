'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ManuaisWebPage() {
  const [tab, setTab] = useState<'usuario' | 'tecnico'>('usuario');
  const [content, setContent] = useState<string>('Carregando manual...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDoc() {
      setLoading(true);
      try {
        const res = await fetch(`/api/docs/${tab}`);
        if (!res.ok) {
          setContent('Não foi possível carregar a documentação solicitada.');
          return;
        }
        const text = await res.text();
        setContent(text);
      } catch {
        setContent('Erro ao conectar ao servidor de documentação.');
      } finally {
        setLoading(false);
      }
    }
    void loadDoc();
  }, [tab]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <Link href="/painel" className="text-xs text-sky-400 hover:underline">
            ← Voltar ao Painel
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Central de Manuais e Documentação
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Guias completos de uso, recursos pedagógicos e arquitetura técnica do EduForge.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-3">
        <button
          onClick={() => setTab('usuario')}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            tab === 'usuario'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
              : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          📘 Manual do Usuário
        </button>
        <button
          onClick={() => setTab('tecnico')}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            tab === 'tecnico'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          ⚙️ Manual Técnico & Arquitetura
        </button>
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-md">
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-400">
            Carregando documentação...
          </div>
        ) : (
          <article className="prose prose-invert prose-slate max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-sky-400 prose-code:text-amber-300">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </article>
        )}
      </div>
    </main>
  );
}
