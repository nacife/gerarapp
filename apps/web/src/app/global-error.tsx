'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-950 text-slate-100 font-sans antialiased min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="text-xl font-bold text-white">Falha ao inicializar a aplicação</h1>
          <p className="mt-2 text-sm text-slate-400">
            Houve uma falha crítica de carregamento. Por favor, tente reiniciar a sessão.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-white hover:bg-sky-400 transition"
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/';
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm text-slate-300 hover:bg-slate-700 transition"
            >
              Ir para o Início
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
