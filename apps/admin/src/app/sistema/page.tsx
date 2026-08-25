'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface SystemHealth {
  uptime: number;
  nodeVersion: string;
  memoryMb: number;
  db: string;
  dbLatencyMs?: number;
  redis: string;
  redisLatencyMs?: number;
  storageProvider?: string;
  queues: Record<string, { waiting: number; active: number; failed: number; completed: number }>;
  users: { total: number; active: number; suspended: number };
  projects: { total: number; published: number };
  creditsConsumed7d: number;
}

const QUEUE_LABELS: Record<string, string> = {
  ingest: 'Ingestão',
  generate: 'Geração IA',
  tts: 'Podcast/TTS',
  'inpi-package': 'Pacote INPI',
  'sensei-embed': 'Indexação Sensei',
  'webhook-delivery': 'Entrega Webhooks',
};

export default function SistemaPage() {
  const router = useRouter();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function fetchHealth() {
    setRefreshing(true);
    apiFetch<SystemHealth>('/admin/health').then((res) => {
      if (res.status === 401) return router.replace('/entrar');
      if (res.ok && res.data) setHealth(res.data);
      setLoading(false);
      setRefreshing(false);
    });
  }

  useEffect(() => {
    fetchHealth();
  }, [router]);

  if (loading)
    return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Dashboard do Sistema</h1>
          <p className="text-xs text-gray-400 mt-0.5">Métricas de infraestrutura em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchHealth}
            disabled={refreshing}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition"
          >
            {refreshing ? 'Atualizando...' : '🔄 Atualizar'}
          </button>
          <Link href="/" className="text-sm text-cyan-400 hover:underline">
            ← Voltar
          </Link>
        </div>
      </div>

      {/* Métricas rápidas */}
      {health && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Uptime"
              value={formatUptime(health.uptime)}
              sub="Node.js"
              color="text-emerald-300"
            />
            <StatCard
              label="Memória"
              value={`${health.memoryMb} MB`}
              sub={health.nodeVersion}
              color="text-cyan-300"
            />
            <StatCard
              label="Neon PostgreSQL"
              value={health.db === 'ok' ? 'OK' : 'ERRO'}
              sub={health.dbLatencyMs ? `${health.dbLatencyMs}ms latência` : 'PostgreSQL'}
              color={health.db === 'ok' ? 'text-emerald-300' : 'text-red-300'}
            />
            <StatCard
              label="Upstash Redis"
              value={health.redis === 'ok' ? 'OK' : 'ERRO'}
              sub={health.redisLatencyMs ? `${health.redisLatencyMs}ms latência` : 'BullMQ + Cache'}
              color={health.redis === 'ok' ? 'text-emerald-300' : 'text-red-300'}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Storage de Objetos"
              value={health.storageProvider || 'Cloudflare R2'}
              sub="Zero Egress"
              color="text-amber-300"
            />
            <StatCard
              label="Total Usuários"
              value={String(health.users.total)}
              sub={`${health.users.active} ativos · ${health.users.suspended} suspensos`}
              color="text-gray-200"
            />
            <StatCard
              label="Projetos"
              value={String(health.projects.total)}
              sub={`${health.projects.published} publicados`}
              color="text-gray-200"
            />
            <StatCard
              label="Créditos IA (7d)"
              value={String(health.creditsConsumed7d)}
              sub="consumidos na última semana"
              color="text-amber-300"
            />
          </div>

          {/* Filas BullMQ */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-200">Filas BullMQ</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(health.queues).map(([name, stats]) => (
                <div
                  key={name}
                  className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3"
                >
                  <p className="text-sm font-medium text-gray-300">{QUEUE_LABELS[name] ?? name}</p>
                  <div className="mt-1 flex gap-3 text-xs">
                    <span className="text-gray-500">⏳ {stats.waiting ?? '?'}</span>
                    <span className="text-cyan-300">▶ {stats.active ?? '?'}</span>
                    <span className="text-emerald-300">✓ {stats.completed ?? '?'}</span>
                    {stats.failed > 0 && <span className="text-red-300">✕ {stats.failed}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-600">{sub}</p>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(seconds % 60)}s`;
}
