'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface AnalyticsOverview {
  users: { total: number; today: number; thisWeek: number; thisMonth: number };
  projects: { total: number; today: number };
  credits: { consumedTotal: number; consumedThisMonth: number };
  interactions: number;
  enrollments: number;
  topProjects: { id: string; title: string; slug: string; enrollments: number }[];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AnalyticsOverview>('/admin/analytics/overview').then((res) => {
      if (res.status === 401) return router.replace('/entrar');
      if (res.ok && res.data) setData(res.data);
      setLoading(false);
    });
  }, [router]);

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Analytics do Sistema</h1>
        <Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link>
      </div>

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Usuários" value={fmt(data.users.total)} sub={`+${data.users.today} hoje · +${data.users.thisMonth} no mês`} color="text-gray-200" />
            <StatCard label="Projetos" value={fmt(data.projects.total)} sub={`+${data.projects.today} hoje`} color="text-gray-200" />
            <StatCard label="Interações" value={fmt(data.interactions)} sub="geradas por IA" color="text-cyan-300" />
            <StatCard label="Matrículas" value={fmt(data.enrollments)} sub="de aprendizes" color="text-emerald-300" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Créditos IA (total)" value={fmt(data.credits.consumedTotal)} sub="consumidos desde o início" color="text-amber-300" />
            <StatCard label="Créditos IA (30d)" value={fmt(data.credits.consumedThisMonth)} sub="consumidos este mês" color="text-amber-300" />
          </div>

          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-200">Top 5 Projetos (matrículas)</h2>
            <div className="space-y-2">
              {data.topProjects.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/[0.03] p-3 text-sm">
                  <span className="text-gray-400">#{i + 1} <span className="text-gray-200">{p.title}</span> <span className="text-gray-600">({p.slug})</span></span>
                  <span className="text-cyan-300 font-medium">{p.enrollments} matrículas</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    <p className="mt-0.5 text-xs text-gray-600">{sub}</p>
  </div>;
}
function fmt(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }
