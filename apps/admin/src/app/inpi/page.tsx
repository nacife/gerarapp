'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

type FilingStatus =
  | 'draft'
  | 'awaiting_poa'
  | 'awaiting_payment'
  | 'in_review'
  | 'filed'
  | 'granted'
  | 'rejected'
  | 'revoked';

interface QueueRow {
  id: string;
  status: FilingStatus;
  customerName: string;
  customerEmail: string;
  projectTitle: string;
  versionNumber: number;
  holder: { type: 'pf' | 'pj' } | null;
  slaDueAt: string | null;
  slaAtRisk: boolean;
}

const STATUS_LABEL: Record<FilingStatus, string> = {
  draft: 'rascunho',
  awaiting_poa: 'aguardando procuração',
  awaiting_payment: 'aguardando pagamento',
  in_review: 'pronto p/ protocolo',
  filed: 'protocolado',
  granted: 'concedido',
  rejected: 'rejeitado',
  revoked: 'revogado',
};

export default function InpiQueuePage() {
  const router = useRouter();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [status, setStatus] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState(false);

  async function load() {
    const qs = status ? `?status=${status}` : '';
    const res = await apiFetch<QueueRow[]>(`/admin/inpi/filings${qs}`);
    if (res.status === 401) return router.replace('/entrar');
    if (res.status === 403) return setDenied(true);
    if (res.ok && res.data) setRows(res.data);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, [status]);

  const atRiskCount = rows.filter((r) => r.slaAtRisk).length;

  if (denied) {
    return <main className="grid min-h-screen place-items-center text-rose-400">Acesso restrito a administradores.</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Painel admin
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">INPI — Fila de pedidos</h1>
        </div>
        {atRiskCount > 0 && (
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
            SLA em risco: {atRiskCount} ⚠
          </span>
        )}
      </div>

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-64 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none"
      >
        <option value="">Todos os ativos</option>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      {!loaded ? (
        <p className="text-zinc-500">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum pedido nesta fila.</p>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/inpi/${r.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-zinc-900/60"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {r.projectTitle} v{r.versionNumber}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {r.customerName} ({r.holder?.type === 'pj' ? 'PJ' : 'PF'}) · {r.customerEmail}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{STATUS_LABEL[r.status]}</span>
                {r.slaAtRisk && <span className="text-xs text-amber-400">⚠ SLA</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
