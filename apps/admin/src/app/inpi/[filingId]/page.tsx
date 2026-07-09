'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';

type FilingStatus =
  | 'draft'
  | 'awaiting_poa'
  | 'awaiting_payment'
  | 'in_review'
  | 'filed'
  | 'granted'
  | 'rejected'
  | 'revoked';

interface Holder {
  type: 'pf' | 'pj';
  docNumber: string;
  name: string;
}
interface Filing {
  id: string;
  status: FilingStatus;
  holder: Holder | null;
  authors: { name: string; cpf: string }[] | null;
  poaPdfS3Key: string | null;
  gruNumber: string | null;
  inpiProcessNumber: string | null;
  feeCentsService: number | null;
  feeCentsGru: number | null;
  operatorChecklist: { dvSigned?: boolean; doubleChecked?: boolean; doubleCheckedBy?: string } | null;
  projectTitle: string;
  projectSlug: string;
  versionNumber: number;
  customerName: string;
  customerEmail: string;
}
interface FilingEvent {
  id: string;
  kind: string;
  detail: unknown;
  occurredAt: string;
}
interface Detail {
  filing: Filing;
  events: FilingEvent[];
  poaUrl: string | null;
  certificateUrl: string | null;
  slaDueAt: string | null;
  slaAtRisk: boolean;
}

export default function InpiFilingDetailPage({ params }: { params: { filingId: string } }) {
  const filingId = params.filingId;
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [gruNumber, setGruNumber] = useState('');
  const [inpiProcessNumber, setInpiProcessNumber] = useState('');
  const [rpiNote, setRpiNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [doubleCheckedBy, setDoubleCheckedBy] = useState('');

  async function load() {
    const res = await apiFetch<Detail>(`/admin/inpi/filings/${filingId}`);
    if (res.status === 401) return router.replace('/entrar');
    if (res.ok && res.data) setDetail(res.data);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, [filingId]);

  async function toggleChecklist(key: 'dvSigned' | 'doubleChecked', value: boolean) {
    setBusy(true);
    const body: Record<string, unknown> = { [key]: value };
    if (key === 'doubleChecked' && value && doubleCheckedBy) body.doubleCheckedBy = doubleCheckedBy;
    const res = await apiFetch(`/admin/inpi/filings/${filingId}/checklist`, { method: 'PATCH', body });
    setBusy(false);
    if (res.ok) await load();
    else setMsg(res.problem?.detail ?? 'Falha ao atualizar o checklist.');
  }

  async function claim() {
    setBusy(true);
    const res = await apiFetch(`/admin/inpi/filings/${filingId}/claim`, { method: 'POST' });
    setBusy(false);
    if (res.ok) await load();
  }

  async function protocol(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await apiFetch(`/admin/inpi/filings/${filingId}/protocol`, {
      method: 'POST',
      body: { gruNumber, inpiProcessNumber },
    });
    setBusy(false);
    if (res.ok) {
      setMsg('Pedido protocolado no INPI.');
      await load();
    } else {
      setMsg(res.problem?.detail ?? 'Falha ao protocolar.');
    }
  }

  async function recordRpi(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await apiFetch(`/admin/inpi/filings/${filingId}/rpi-event`, { method: 'POST', body: { note: rpiNote } });
    setBusy(false);
    if (res.ok) {
      setRpiNote('');
      await load();
    } else {
      setMsg(res.problem?.detail ?? 'Falha ao registrar o evento.');
    }
  }

  async function grant() {
    if (!certificateFile) return;
    setBusy(true);
    setMsg(null);
    const urlRes = await apiFetch<{ uploadUrl: string }>(`/admin/inpi/filings/${filingId}/certificate/upload-url`, {
      method: 'POST',
    });
    if (!urlRes.ok || !urlRes.data) {
      setBusy(false);
      return setMsg('Falha ao preparar o envio do certificado.');
    }
    const put = await fetch(urlRes.data.uploadUrl, { method: 'PUT', body: certificateFile });
    if (!put.ok) {
      setBusy(false);
      return setMsg('Falha ao enviar o certificado.');
    }
    const res = await apiFetch(`/admin/inpi/filings/${filingId}/grant`, { method: 'POST' });
    setBusy(false);
    if (res.ok) {
      setMsg('Certificado de Registro entregue ao cliente.');
      await load();
    } else {
      setMsg(res.problem?.detail ?? 'Falha ao conceder.');
    }
  }

  async function reject() {
    if (!rejectReason.trim()) return setMsg('Informe o motivo da rejeição.');
    if (!window.confirm('Rejeitar este pedido? Esta ação é registrada em auditoria.')) return;
    setBusy(true);
    const res = await apiFetch(`/admin/inpi/filings/${filingId}/reject`, { method: 'POST', body: { reason: rejectReason } });
    setBusy(false);
    if (res.ok) await load();
    else setMsg(res.problem?.detail ?? 'Falha ao rejeitar.');
  }

  if (!loaded || !detail) {
    return <main className="grid min-h-screen place-items-center text-zinc-500">Carregando…</main>;
  }

  const { filing, events } = detail;
  const checklist = {
    zipOk: true, // pré-condição de contract(): só existe filing se já havia certificação RF-16
    fichaOk: true,
    poaOk: !!filing.poaPdfS3Key,
    gruOk: filing.feeCentsGru != null,
    dvSigned: filing.operatorChecklist?.dvSigned ?? false,
    doubleChecked: filing.operatorChecklist?.doubleChecked ?? false,
  };
  const readyToProtocol = checklist.zipOk && checklist.fichaOk && checklist.poaOk && checklist.gruOk && checklist.dvSigned && checklist.doubleChecked;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/inpi" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Fila INPI
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {filing.projectTitle} v{filing.versionNumber}
          </h1>
          <p className="text-sm text-zinc-500">
            {filing.customerName} · {filing.customerEmail} · {filing.holder?.type === 'pj' ? 'PJ' : 'PF'}
          </p>
        </div>
        {detail.slaAtRisk && (
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">SLA em risco ⚠</span>
        )}
      </div>

      {msg && <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">{msg}</p>}

      <button onClick={claim} disabled={busy} className="w-fit rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:border-zinc-600">
        Assumir este pedido
      </button>

      {filing.status === 'in_review' && (
        <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="font-semibold">Checklist</h2>
          <ul className="space-y-1.5 text-sm">
            <li>☑ ZIP ok</li>
            <li>☑ Ficha ok</li>
            <li>{checklist.poaOk ? '☑' : '☐'} Procuração</li>
            <li>{checklist.gruOk ? '☑' : '☐'} GRU paga</li>
            <li>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checklist.dvSigned}
                  onChange={(e) => toggleChecklist('dvSigned', e.target.checked)}
                />
                DV baixada e assinada (pelo procurador designado)
              </label>
            </li>
            <li className="flex items-center gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checklist.doubleChecked}
                  onChange={(e) => toggleChecklist('doubleChecked', e.target.checked)}
                />
                Dupla conferência (2º operador)
              </label>
              <input
                value={doubleCheckedBy}
                onChange={(e) => setDoubleCheckedBy(e.target.value)}
                placeholder="nome do 2º operador"
                className="w-40 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs"
              />
            </li>
          </ul>

          <form onSubmit={protocol} className="space-y-2 border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-500">Protocolar no e-Software (execução manual pelo operador):</p>
            <input
              value={gruNumber}
              onChange={(e) => setGruNumber(e.target.value)}
              placeholder="Nosso número (GRU)"
              required
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <input
              value={inpiProcessNumber}
              onChange={(e) => setInpiProcessNumber(e.target.value)}
              placeholder="Número do processo INPI (ex.: BR 51 2026 001234-5)"
              required
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <button
              disabled={busy || !readyToProtocol}
              title={!readyToProtocol ? 'Complete o checklist antes de protocolar' : undefined}
              className="w-full rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-40"
            >
              Protocolar
            </button>
          </form>

          <button onClick={reject} disabled={busy} className="text-xs text-rose-400 hover:underline">
            Rejeitar pedido
          </button>
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo da rejeição"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs"
          />
        </section>
      )}

      {filing.status === 'filed' && (
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="font-semibold">Acompanhamento</h2>
          <dl className="text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Processo INPI</dt>
              <dd>{filing.inpiProcessNumber}</dd>
            </div>
          </dl>
          <form onSubmit={recordRpi} className="space-y-2">
            <p className="text-xs text-zinc-500">Registrar despacho da RPI (monitoramento manual):</p>
            <textarea
              value={rpiNote}
              onChange={(e) => setRpiNote(e.target.value)}
              placeholder="Ex.: Despacho de exigência formal — nenhuma pendência."
              required
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <button disabled={busy} className="rounded-lg border border-zinc-800 px-4 py-2 text-sm hover:border-zinc-600">
              Registrar evento
            </button>
          </form>

          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-500">Entregar Certificado de Registro (baixado do INPI):</p>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setCertificateFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-400"
            />
            <button
              onClick={grant}
              disabled={busy || !certificateFile}
              className="w-full rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              Conceder e notificar cliente
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-zinc-500">Linha do tempo</h2>
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{e.kind}</span>
                <span className="text-xs text-zinc-500">{new Date(e.occurredAt).toLocaleString('pt-BR')}</span>
              </div>
              {e.detail != null && (
                <pre className="mt-1 overflow-x-auto rounded bg-zinc-950 p-2 text-xs text-zinc-400">
                  {JSON.stringify(e.detail, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
