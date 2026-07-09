'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface RateLimitConfig { maxRequestsPerMinute: number; windowSeconds: number; description: string }
interface AiCreditsConfig { costPerInteraction: number; costTutorQuestion: number; costPodcast: number; costIllustration: number; lowBalanceThreshold: number; description: string }
interface EnvironmentConfig { nodeEnv: string; aiProvider: string; mailer: string; appBaseUrl: string; adminBaseUrl: string; runtimeBaseUrl: string; corsOrigins: string[]; inpiGruFeeCents: number; inpiServiceFeeCents: number }
interface RoutesConfig { scopes: string[]; queues: string[]; totalEndpoints: string }

export default function ConfigPage() {
  const router = useRouter();
  const [rateLimit, setRateLimit] = useState<RateLimitConfig | null>(null);
  const [aiCredits, setAiCredits] = useState<AiCreditsConfig | null>(null);
  const [env, setEnv] = useState<EnvironmentConfig | null>(null);
  const [routes, setRoutes] = useState<RoutesConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<RateLimitConfig>('/admin/config/rate-limit'),
      apiFetch<AiCreditsConfig>('/admin/config/ai-credits'),
      apiFetch<EnvironmentConfig>('/admin/config/environment'),
      apiFetch<RoutesConfig>('/admin/config/routes'),
    ]).then(([rl, ai, en, rt]) => {
      if (rl.status === 401) return router.replace('/entrar');
      if (rl.ok && rl.data) setRateLimit(rl.data);
      if (ai.ok && ai.data) setAiCredits(ai.data);
      if (en.ok && en.data) setEnv(en.data);
      if (rt.ok && rt.data) setRoutes(rt.data);
      setLoading(false);
    });
  }, [router]);

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Configuração de APIs</h1>
        <Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link>
      </div>

      {/* Rate Limit */}
      {rateLimit && (
        <ConfigSection title="Rate Limiting">
          <ConfigRow label="Requisições/min" value={String(rateLimit.maxRequestsPerMinute)} />
          <ConfigRow label="Janela (segundos)" value={String(rateLimit.windowSeconds)} />
          <ConfigRow label="Descrição" value={rateLimit.description} />
        </ConfigSection>
      )}

      {/* AI Credits */}
      {aiCredits && (
        <ConfigSection title="Custos de Créditos IA">
          <ConfigRow label="Interação" value={`${aiCredits.costPerInteraction} créd.`} />
          <ConfigRow label="Tutor Sensei" value={`${aiCredits.costTutorQuestion} créd.`} />
          <ConfigRow label="Podcast" value={`${aiCredits.costPodcast} créd.`} />
          <ConfigRow label="Ilustração" value={`${aiCredits.costIllustration} créd.`} />
          <ConfigRow label="Alerta saldo baixo" value={`< ${aiCredits.lowBalanceThreshold} créd.`} />
        </ConfigSection>
      )}

      {/* Environment */}
      {env && (
        <ConfigSection title="Ambiente">
          <ConfigRow label="Node ENV" value={env.nodeEnv} />
          <ConfigRow label="AI Provider" value={env.aiProvider} />
          <ConfigRow label="Mailer" value={env.mailer} />
          <ConfigRow label="App URL" value={env.appBaseUrl} />
          <ConfigRow label="Admin URL" value={env.adminBaseUrl} />
          <ConfigRow label="Runtime URL" value={env.runtimeBaseUrl} />
          <ConfigRow label="CORS Origins" value={env.corsOrigins.join(', ')} />
          <ConfigRow label="INPI GRU (cents)" value={`R$ ${(env.inpiGruFeeCents / 100).toFixed(2)}`} />
          <ConfigRow label="INPI Serviço (cents)" value={`R$ ${(env.inpiServiceFeeCents / 100).toFixed(2)}`} />
        </ConfigSection>
      )}

      {/* API Routes */}
      {routes && (
        <ConfigSection title="Endpoints e Escopos">
          <ConfigRow label="Total endpoints" value={routes.totalEndpoints} />
          <div className="mt-2">
            <p className="mb-1 text-xs text-gray-500">Escopos disponíveis:</p>
            <div className="flex flex-wrap gap-1">
              {routes.scopes.map((s) => (
                <span key={s} className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">{s}</span>
              ))}
            </div>
          </div>
          <div className="mt-2">
            <p className="mb-1 text-xs text-gray-500">Filas BullMQ:</p>
            <div className="flex flex-wrap gap-1">
              {routes.queues.map((q) => (
                <span key={q} className="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-gray-400">{q}</span>
              ))}
            </div>
          </div>
        </ConfigSection>
      )}
    </main>
  );
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <h2 className="mb-3 text-lg font-semibold text-gray-200">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.03] pb-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-medium">{value}</span>
    </div>
  );
}
