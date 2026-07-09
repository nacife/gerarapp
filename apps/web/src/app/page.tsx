const templates = [
  { name: 'Moderno', hint: 'cards • sombras suaves', ring: 'ring-sky-400/40' },
  { name: 'Contemporâneo', hint: 'editorial • serifada', ring: 'ring-amber-400/40' },
  { name: 'Futurista', hint: 'dark • glassmorphism', ring: 'ring-fuchsia-400/40' },
  { name: 'Minimalista', hint: 'foco no texto', ring: 'ring-slate-400/40' },
];

const steps = ['Upload', 'Mapa de Conteúdo', 'Visual', 'Interações', 'Publicar'];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 font-black text-slate-950">
            E
          </div>
          <span className="text-lg font-semibold tracking-tight">EduForge</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/entrar" className="text-slate-300 transition hover:text-white">
            Entrar
          </a>
          <a
            href="/cadastro"
            className="rounded-full bg-slate-100 px-4 py-1.5 font-medium text-slate-950 transition hover:bg-white"
          >
            Criar conta
          </a>
        </nav>
      </header>

      <section className="flex flex-col items-start gap-6">
        <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300">
          Painel do Criador
        </span>
        <h1 className="max-w-3xl bg-gradient-to-br from-white to-slate-400 bg-clip-text text-5xl font-bold leading-tight tracking-tight text-transparent sm:text-6xl">
          De um PDF a um aplicativo de aprendizagem em menos de 30 minutos.
        </h1>
        <p className="max-w-2xl text-lg text-slate-400">
          Ingestão por IA, interações geradas automaticamente, estúdio visual e publicação como
          PWA — com qualidade de estúdio de design instrucional.
        </p>
        <button className="rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110">
          + Novo app a partir de arquivo
        </button>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
          Templates do estúdio
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((t) => (
            <div
              key={t.name}
              className={`rounded-2xl border border-slate-800 bg-slate-900/50 p-5 ring-1 ${t.ring} transition hover:-translate-y-1 hover:bg-slate-900`}
            >
              <div className="mb-8 h-24 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900" />
              <p className="font-semibold">{t.name}</p>
              <p className="text-sm text-slate-500">{t.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
          Fluxo guiado em 5 passos
        </h2>
        <ol className="flex flex-wrap gap-3">
          {steps.map((step, i) => (
            <li
              key={step}
              className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-xs text-slate-400">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-auto flex items-center justify-between border-t border-slate-800 pt-6 text-sm text-slate-500">
        <span>EduForge · MVP em construção</span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Fundação (M0) no ar
        </span>
      </footer>
    </main>
  );
}
