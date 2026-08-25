'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('Client Exception capturada pelo ErrorBoundary:', error);
  }, [error]);

  function handleHardRefresh() {
    // Limpa caches de navegação e força recarregamento limpo
    if (typeof window !== 'undefined') {
      window.location.href = window.location.pathname;
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 text-3xl border border-rose-500/30">
            ⚠️
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold tracking-tight text-white">
          Ops! Algo não saiu como esperado
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Ocorreu uma instabilidade temporária no carregamento da página ou nos dados do navegador.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 active:scale-[0.99]"
          >
            Tentar Novamente
          </button>

          <button
            onClick={handleHardRefresh}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 font-medium text-slate-200 transition hover:bg-slate-700 active:scale-[0.99]"
          >
            Recarregar Página
          </button>

          <Link
            href="/"
            className="w-full text-center py-2 text-xs font-medium text-slate-400 hover:text-sky-400 transition"
          >
            Voltar para a Página Inicial
          </Link>
        </div>

        {error?.message && (
          <div className="mt-6 border-t border-slate-800 pt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-slate-500 hover:text-slate-400 flex items-center justify-between w-full"
            >
              <span>Detalhes técnicos</span>
              <span>{showDetails ? '▲ Ocultar' : '▼ Exibir'}</span>
            </button>
            {showDetails && (
              <div className="mt-2 rounded-lg bg-slate-950/80 p-3 text-xs text-rose-300 font-mono break-all max-h-36 overflow-auto border border-rose-950">
                <p>{error.message}</p>
                {error.digest && <p className="mt-1 text-slate-500">Digest: {error.digest}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
