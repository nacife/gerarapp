import Link from 'next/link';
import { Badge, Button, Card, Logo, SectionHeading } from '../components/ui';

const templates = [
  { name: 'Moderno', hint: 'Cards • sombras suaves • bordas generosas', color: 'from-cyan-400 to-cyan-600' },
  { name: 'Contemporâneo', hint: 'Editorial • serifada • clean', color: 'from-cyan-500 to-teal-500' },
  { name: 'Futurista', hint: 'Dark • glassmorphism • imersivo', color: 'from-cyan-300 to-blue-500' },
  { name: 'Minimalista', hint: 'Foco no texto • sem distrações', color: 'from-gray-400 to-gray-600' },
];

const steps = ['Upload do PDF', 'Mapa de Conteúdo', 'Estúdio Visual', 'Interações IA', 'Revisão & Publicação'];

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-20 px-6 py-12">
      {/* Header */}
      <header className="flex items-center justify-between animate-in">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <span className="text-lg font-semibold tracking-tight text-gray-200">EduForge</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/entrar" className="text-gray-400 transition hover:text-gray-200">
            Entrar
          </Link>
          <Link href="/cadastro">
            <Button variant="primary" size="sm">Criar conta</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-start gap-6 animate-in stagger-1">
        <Badge variant="info">Painel do Criador</Badge>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          <span className="bg-cyan-text bg-clip-text text-transparent">
            De um PDF a um aplicativo de aprendizagem
          </span>
          <br />
          <span className="text-gray-200">em menos de 30 minutos.</span>
        </h1>
        <p className="max-w-2xl text-lg text-gray-400 leading-relaxed">
          Pipeline de IA que transforma documentos em experiências interativas: extração,
          estruturação, 9 tipos de interações, estúdio visual e publicação PWA —
          com qualidade de design instrucional profissional.
        </p>
        <div className="flex gap-3">
          <Link href="/cadastro">
            <Button variant="primary" size="lg">
              <span className="text-lg mr-1">+</span> Criar meu primeiro app
            </Button>
          </Link>
          <Link href="/entrar">
            <Button variant="secondary" size="lg">Já tenho conta</Button>
          </Link>
        </div>
      </section>

      {/* Templates */}
      <section className="animate-in stagger-2">
        <SectionHeading
          title="Templates premium"
          subtitle="4 estilos de design profissional com verificação WCAG AA"
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((t) => (
            <Card key={t.name} hover>
              <div className={`mb-6 h-20 rounded-xl bg-gradient-to-br ${t.color} opacity-60`} />
              <p className="font-semibold text-gray-200">{t.name}</p>
              <p className="text-sm text-gray-500">{t.hint}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="animate-in stagger-3">
        <SectionHeading
          title="Fluxo guiado em 5 passos"
          subtitle="Do upload à publicação em menos de 30 minutos"
        />
        <div className="mt-6 flex flex-wrap gap-3">
          {steps.map((step, i) => (
            <Card key={step} className="flex items-center gap-3 !py-3 !px-4">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-cyan-gradient text-xs font-bold text-gray-950">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-gray-300">{step}</span>
            </Card>
          ))}
        </div>
      </section>

      {/* Stats / Social proof */}
      <section className="animate-in stagger-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { value: '9', label: 'Tipos de interação', sub: 'Quiz, flashcards, cloze, drag & drop, etc.' },
            { value: '15', label: 'Paletas de cores', sub: 'Verificação WCAG AA automática' },
            { value: '<30min', label: 'Do upload à publicação', sub: 'Pipeline de IA ponta a ponta' },
          ].map((s) => (
            <Card key={s.label}>
              <p className="text-3xl font-bold bg-cyan-text bg-clip-text text-transparent">{s.value}</p>
              <p className="mt-1 font-semibold text-gray-200">{s.label}</p>
              <p className="mt-1 text-sm text-gray-500">{s.sub}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="animate-in stagger-5 text-center">
        <Card className="!bg-cyan-radial !border-cyan-500/15">
          <h2 className="text-2xl font-bold text-gray-100">Pronto para criar seu primeiro app?</h2>
          <p className="mt-2 text-gray-400">
            Comece agora e tenha um app interativo publicado em minutos.
          </p>
          <div className="mt-6">
            <Link href="/cadastro">
              <Button variant="primary" size="lg">Começar gratuitamente</Button>
            </Link>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-6 text-sm text-gray-500 animate-in stagger-6">
        <span>EduForge · M0–M10 completo</span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
          Plataforma operacional
        </span>
      </footer>
    </div>
  );
}
