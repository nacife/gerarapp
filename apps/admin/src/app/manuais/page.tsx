'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiFetch } from '../../lib/api';

export default function ManuaisPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'usuario' | 'tecnico'>('usuario');
  const [content, setContent] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const res = await apiFetch<{ role: string }>('/auth/me');
      if (!res.ok || !res.data) {
        router.replace('/entrar');
        return;
      }
      setIsAdmin(['admin', 'super_admin'].includes(res.data.role));
    }
    void init();
  }, [router]);

  useEffect(() => {
    async function loadManual() {
      setContent('Carregando...');
      setError(null);
      const res = await fetch(`/api/docs/${tab}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError('Você não tem permissão para acessar este manual.');
        } else {
          setError('Erro ao carregar o manual.');
        }
        setContent('');
        return;
      }
      const text = await res.text();
      setContent(text);
    }
    void loadManual();
  }, [tab]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            &larr; Voltar
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Manuais do Sistema</h1>
        </div>
      </header>

      <div className="flex gap-4 border-b border-zinc-800">
        <button
          onClick={() => setTab('usuario')}
          className={`pb-3 text-sm font-medium ${
            tab === 'usuario' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Manual do Usuário
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab('tecnico')}
            className={`pb-3 text-sm font-medium ${
              tab === 'tecnico' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Manual Técnico
          </button>
        )}
      </div>

      <article className="prose prose-invert prose-indigo max-w-none rounded-xl bg-slate-900/50 p-8 shadow-sm ring-1 ring-white/10">
        {error ? (
          <div className="text-rose-400">{error}</div>
        ) : (
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        )}
      </article>
    </main>
  );
}
