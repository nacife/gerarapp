'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

type DisplayStatus = 'draft' | 'published' | 'pending_update';

interface HomeProject {
  id: string;
  slug: string;
  title: string;
  displayStatus: DisplayStatus;
  accessMode: string;
  createdAt: string;
  publishedAt: string | null;
  themeColors: { primary: string; accent: string } | null;
  sessionsThisWeek: number;
  interactionCount: number;
}

interface PlanUsage {
  planKey: string;
  limits: { apps: number; uploadMb: number; aiCreditsMonthly: number; customDomains: number };
  usage: { apps: number; storageBytes: number; aiCreditsBalance: number };
}

interface Home {
  projects: HomeProject[];
  planUsage: PlanUsage;
  highlights: string[];
}

const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  pending_update: 'Atualização pendente',
};

const STATUS_STYLE: Record<DisplayStatus, string> = {
  draft: 'bg-slate-800 text-slate-400',
  published: 'bg-emerald-500/15 text-emerald-300',
  pending_update: 'bg-amber-500/15 text-amber-300',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UsageBar({ label, used, limit, suffix = '' }: { label: string; used: number; limit: number; suffix?: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>
          {used}
          {suffix} / {limit}
          {suffix}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${pct >= 90 ? 'bg-rose-400' : 'bg-gradient-to-r from-sky-400 to-fuchsia-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function PainelPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Me>('/auth/me').then((res) => {
      if (!res.ok) {
        router.replace('/entrar');
        return;
      }
      setMe(res.data);
      setLoading(false);
      void apiFetch<Home>('/me/home').then((r) => {
        if (r.ok && r.data) setHome(r.data);
      });
    });
  }, [router]);

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    router.replace('/entrar');
  }

  if (loading || !me) {
    return <main className="grid min-h-screen place-items-center text-slate-400">Carregando…</main>;
  }

  const projects = home?.projects ?? [];
  const usage = home?.planUsage;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 font-black text-slate-950">
            E
          </span>
          <div>
            <p className="font-semibold">Olá, {me.name}</p>
            <p className="text-xs text-slate-500">{me.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/configuracoes" className="text-sm text-slate-400 hover:text-white">
            Configurações
          </Link>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Link
          href="/novo"
          className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-fuchsia-500 px-5 py-6 text-lg font-semibold text-slate-950 shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110"
        >
          + Novo app a partir de arquivo
        </Link>

        {usage && (
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Plano <span className="text-slate-300">{usage.planKey}</span>
            </p>
            <UsageBar label="Apps" used={usage.usage.apps} limit={usage.limits.apps} />
            <UsageBar
              label="Créditos de IA"
              used={usage.usage.aiCreditsBalance}
              limit={usage.limits.aiCreditsMonthly}
            />
            <p className="text-xs text-slate-500">
              Armazenamento: {formatBytes(usage.usage.storageBytes)} / {usage.limits.uploadMb} MB por arquivo
            </p>
          </div>
        )}
      </div>

      {home && home.highlights.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Destaques</h2>
          <div className="space-y-1.5">
            {home.highlights.map((h, i) => (
              <p key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">
                ✨ {h}
              </p>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">
          Meus apps ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum app ainda. Envie um arquivo para começar.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => {
              const colors = p.themeColors ?? { primary: '#0ea5e9', accent: '#22d3ee' };
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 transition hover:-translate-y-0.5 hover:bg-slate-900"
                >
                  <Link href={p.displayStatus === 'published' ? `/projeto/${p.id}/revisar` : `/projeto/${p.id}/mapa`}>
                    <div
                      className="h-2"
                      style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})` }}
                    />
                    <div className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{p.title}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[p.displayStatus]}`}>
                          {STATUS_LABEL[p.displayStatus]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {p.slug} · {p.interactionCount} interações
                      </p>
                      {p.displayStatus !== 'draft' && (
                        <p className="mt-2 text-xs text-slate-400">{p.sessionsThisWeek} sessões esta semana</p>
                      )}
                    </div>
                  </Link>
                  {p.displayStatus !== 'draft' && (
                    <Link
                      href={`/projeto/${p.id}/analytics`}
                      className="block border-t border-slate-800 px-4 py-2 text-xs text-sky-400 hover:underline"
                    >
                      Ver analytics →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
