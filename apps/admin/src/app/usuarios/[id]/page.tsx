'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';

interface Detail {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'active' | 'suspended' | 'pending_deletion';
  createdAt: string;
  emailVerifiedAt: string | null;
  projectCount: number;
  planKey: string | null;
  creditBalance: number;
}

interface AuditRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  beforeAfter: unknown;
  createdAt: string;
}

const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_APP_URL ?? 'http://localhost:3000';

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const userId = params.id;
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [creditDelta, setCreditDelta] = useState(100);
  const [creditReason, setCreditReason] = useState('');

  async function load() {
    const [d, a] = await Promise.all([
      apiFetch<Detail>(`/admin/users/${userId}`),
      apiFetch<AuditRow[]>(`/admin/users/${userId}/audit-logs`),
    ]);
    if (d.status === 401) return router.replace('/entrar');
    if (!d.ok || !d.data) return setNotFound(true);
    setDetail(d.data);
    if (a.ok && a.data) setLogs(a.data);
  }

  useEffect(() => {
    void load();
  }, [userId]);

  async function suspend() {
    if (!reason.trim()) return setMsg('Informe o motivo da suspensão.');
    if (!window.confirm(`Suspender a conta de ${detail?.email}?`)) return;
    setBusy(true);
    const res = await apiFetch(`/admin/users/${userId}/suspend`, { method: 'POST', body: { reason } });
    setBusy(false);
    setMsg(res.ok ? 'Conta suspensa.' : (res.problem?.detail ?? 'Falha ao suspender.'));
    if (res.ok) { setReason(''); await load(); }
  }

  async function reactivate() {
    setBusy(true);
    const res = await apiFetch(`/admin/users/${userId}/reactivate`, { method: 'POST' });
    setBusy(false);
    setMsg(res.ok ? 'Conta reativada.' : (res.problem?.detail ?? 'Falha ao reativar.'));
    if (res.ok) await load();
  }

  async function revokeSessions() {
    setBusy(true);
    const res = await apiFetch<{ revoked: number }>(`/admin/users/${userId}/revoke-sessions`, { method: 'POST' });
    setBusy(false);
    setMsg(res.ok ? `${res.data?.revoked ?? 0} sessão(ões) revogada(s).` : (res.problem?.detail ?? 'Falha.'));
    if (res.ok) await load();
  }

  async function forcePasswordReset() {
    setBusy(true);
    const res = await apiFetch(`/admin/users/${userId}/force-password-reset`, { method: 'POST' });
    setBusy(false);
    setMsg(res.ok ? 'E-mail de redefinição enviado.' : (res.problem?.detail ?? 'Falha.'));
  }

  async function grantCredits(e: FormEvent) {
    e.preventDefault();
    if (!creditReason.trim()) return setMsg('Informe o motivo da concessão de créditos.');
    setBusy(true);
    const res = await apiFetch(`/admin/users/${userId}/credits`, {
      method: 'POST',
      body: { delta: creditDelta, reason: creditReason },
    });
    setBusy(false);
    setMsg(res.ok ? 'Créditos concedidos.' : (res.problem?.detail ?? 'Falha ao conceder créditos.'));
    if (res.ok) { setCreditReason(''); await load(); }
  }

  async function impersonate() {
    if (
      !window.confirm(
        `Você entrará como ${detail?.email} numa sessão de suporte, aberta em nova aba.\n\n` +
          'Isso substitui sua sessão de admin neste navegador (mesmo em outras abas). ' +
          'Use uma janela anônima se quiser manter as duas sessões. Continuar?',
      )
    )
      return;
    setBusy(true);
    const res = await apiFetch<{ token: string }>(`/admin/users/${userId}/impersonate`, { method: 'POST' });
    setBusy(false);
    if (!res.ok || !res.data) return setMsg(res.problem?.detail ?? 'Falha ao iniciar impersonação.');
    window.open(`${WEB_APP_URL}/impersonar?token=${encodeURIComponent(res.data.token)}`, '_blank');
    setMsg('Sessão de suporte aberta em nova aba.');
  }

  if (notFound) {
    return <main className="grid min-h-screen place-items-center text-zinc-500">Usuário não encontrado.</main>;
  }
  if (!detail) {
    return <main className="grid min-h-screen place-items-center text-zinc-500">Carregando…</main>;
  }

  const canImpersonate = detail.role === 'creator' || detail.role === 'org_admin';

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <Link href="/usuarios" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Usuários
      </Link>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{detail.name}</h1>
          <p className="text-sm text-zinc-500">{detail.email}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            detail.status === 'active'
              ? 'bg-emerald-500/15 text-emerald-300'
              : detail.status === 'suspended'
                ? 'bg-rose-500/15 text-rose-300'
                : 'bg-amber-500/15 text-amber-300'
          }`}
        >
          {detail.status}
        </span>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Papel', detail.role],
          ['Plano', detail.planKey ?? '—'],
          ['Apps', String(detail.projectCount)],
          ['Créditos IA', String(detail.creditBalance)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </section>

      {msg && <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">{msg}</p>}

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">Ações</h2>

        <div className="flex flex-wrap gap-2">
          {detail.status === 'active' ? (
            <>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo da suspensão"
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              />
              <button
                onClick={suspend}
                disabled={busy}
                className="rounded-lg bg-rose-500/20 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
              >
                Suspender
              </button>
            </>
          ) : detail.status === 'suspended' ? (
            <button
              onClick={reactivate}
              disabled={busy}
              className="rounded-lg bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              Reativar conta
            </button>
          ) : null}

          <button
            onClick={revokeSessions}
            disabled={busy}
            className="rounded-lg border border-zinc-800 px-3 py-2 text-sm hover:border-zinc-600 disabled:opacity-50"
          >
            Revogar sessões
          </button>
          <button
            onClick={forcePasswordReset}
            disabled={busy}
            className="rounded-lg border border-zinc-800 px-3 py-2 text-sm hover:border-zinc-600 disabled:opacity-50"
          >
            Forçar redefinição de senha
          </button>
          {canImpersonate && (
            <button
              onClick={impersonate}
              disabled={busy}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
            >
              🔧 Impersonar (sessão de suporte)
            </button>
          )}
        </div>
        {canImpersonate && (
          <p className="text-xs text-zinc-500">
            Abre em nova aba e substitui sua sessão de admin neste navegador. Use uma janela
            anônima se precisar manter as duas sessões ativas ao mesmo tempo.
          </p>
        )}

        <form onSubmit={grantCredits} className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
          <input
            type="number"
            value={creditDelta}
            onChange={(e) => setCreditDelta(Number(e.target.value))}
            className="w-28 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
          />
          <input
            value={creditReason}
            onChange={(e) => setCreditReason(e.target.value)}
            placeholder="Motivo da concessão"
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
          />
          <button
            disabled={busy}
            className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            Conceder créditos
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-zinc-500">Trilha de auditoria</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum evento registrado.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{l.action}</span>
                  <span className="text-xs text-zinc-500">{new Date(l.createdAt).toLocaleString('pt-BR')}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">ator: {l.actorId ?? 'sistema'} ({l.actorRole ?? '—'})</p>
                {l.beforeAfter != null && (
                  <pre className="mt-1 overflow-x-auto rounded bg-zinc-950 p-2 text-xs text-zinc-400">
                    {JSON.stringify(l.beforeAfter, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
