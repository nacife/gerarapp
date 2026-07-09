'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../../../../lib/api';

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
interface Author {
  name: string;
  cpf: string;
}
interface Filing {
  id: string;
  status: FilingStatus;
  holder: Holder | null;
  authors: Author[] | null;
  gruNumber: string | null;
  inpiProcessNumber: string | null;
  feeCentsService: number | null;
  feeCentsGru: number | null;
  projectTitle: string;
  versionNumber: number;
  createdAt: string;
}
interface FilingEvent {
  id: string;
  kind: string;
  detail: unknown;
  occurredAt: string;
}
interface Timeline {
  filing: Filing;
  events: FilingEvent[];
  poaUrl: string | null;
  certificateUrl: string | null;
}
interface Pricing {
  serviceFeeCents: number;
  gruFeeCents: number;
  totalCents: number;
}

const STATUS_LABEL: Record<FilingStatus, string> = {
  draft: 'Rascunho — coletando dados',
  awaiting_poa: 'Aguardando procuração assinada',
  awaiting_payment: 'Aguardando pagamento',
  in_review: 'Em conferência pela EduForge',
  filed: 'Protocolado no INPI',
  granted: 'Concedido',
  rejected: 'Rejeitado',
  revoked: 'Revogado',
};

const EVENT_LABEL: Record<string, string> = {
  created: 'Contrato aceito e dados coletados',
  poa_signed: 'Procuração assinada e validada',
  gru_paid: 'Pagamento confirmado (honorários + GRU)',
  filed: 'Protocolado no e-Software',
  rpi_dispatch: 'Despacho publicado na RPI',
  granted: 'Certificado de Registro emitido',
  note: 'Anotação',
};

function money(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function idempotencyKey(): string {
  return crypto.randomUUID();
}

export default function AssistedFilingPage({ params }: { params: { id: string; filingId: string } }) {
  const projectId = params.id;
  const filingId = params.filingId;
  const router = useRouter();

  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Passo "dados guiados"
  const [holderType, setHolderType] = useState<'pf' | 'pj'>('pf');
  const [docNumber, setDocNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [authors, setAuthors] = useState<Author[]>([{ name: '', cpf: '' }]);

  // Passo "procuração"
  const [hasCert, setHasCert] = useState<boolean | null>(null);
  const [signerDocType, setSignerDocType] = useState<'e-cpf' | 'e-cnpj'>('e-cpf');
  const [signerDocNumber, setSignerDocNumber] = useState('');
  const [poaFile, setPoaFile] = useState<File | null>(null);

  async function load() {
    const [t, p] = await Promise.all([
      apiFetch<Timeline>(`/inpi/filings/${filingId}`),
      apiFetch<Pricing>('/inpi/filings/pricing'),
    ]);
    if (t.status === 401) return router.replace('/entrar');
    if (t.ok && t.data) setTimeline(t.data);
    if (p.ok && p.data) setPricing(p.data);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, [filingId]);

  async function submitData(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await apiFetch(`/inpi/filings/${filingId}/data`, {
      method: 'PATCH',
      body: {
        holder: { type: holderType, docNumber, name: holderName },
        authors: authors.filter((a) => a.name.trim() && a.cpf.trim()),
      },
    });
    setBusy(false);
    if (res.ok) await load();
    else setMsg(res.problem?.detail ?? 'Falha ao salvar os dados.');
  }

  async function sendPoa() {
    if (!poaFile) return;
    setBusy(true);
    setMsg(null);
    const urlRes = await apiFetch<{ uploadUrl: string }>(`/inpi/filings/${filingId}/poa/upload-url`, {
      method: 'POST',
    });
    if (!urlRes.ok || !urlRes.data) {
      setBusy(false);
      return setMsg('Falha ao preparar o envio da procuração.');
    }
    const put = await fetch(urlRes.data.uploadUrl, { method: 'PUT', body: poaFile });
    if (!put.ok) {
      setBusy(false);
      return setMsg('Falha ao enviar o arquivo.');
    }
    const res = await apiFetch(`/inpi/filings/${filingId}/poa/confirm`, {
      method: 'POST',
      body: { declaredSignerDocType: signerDocType, declaredSignerDocNumber: signerDocNumber },
      headers: { 'Idempotency-Key': idempotencyKey() },
    });
    setBusy(false);
    if (res.ok) {
      setPoaFile(null);
      await load();
    } else {
      setMsg(res.problem?.detail ?? 'Procuração recusada.');
    }
  }

  async function pay() {
    setBusy(true);
    setMsg(null);
    const res = await apiFetch(`/inpi/filings/${filingId}/payment`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
    });
    setBusy(false);
    if (res.ok) await load();
    else setMsg(res.problem?.detail ?? 'Falha ao confirmar o pagamento.');
  }

  async function revoke() {
    if (!window.confirm('Revogar a procuração cancela o Registro Assistido (sem custo de GRU). Continuar?')) return;
    setBusy(true);
    const res = await apiFetch(`/inpi/filings/${filingId}/revoke`, { method: 'POST' });
    setBusy(false);
    if (res.ok) await load();
    else setMsg(res.problem?.detail ?? 'Falha ao revogar.');
  }

  if (!loaded || !timeline) {
    return <main className="grid min-h-screen place-items-center text-slate-400">Carregando…</main>;
  }

  const { filing, events, poaUrl, certificateUrl } = timeline;
  const canRevoke = !['granted', 'rejected', 'revoked'].includes(filing.status);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <Link href={`/projeto/${projectId}/inpi`} className="text-sm text-sky-400 hover:underline">
          ← Registro INPI
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Registro Assistido</h1>
        <p className="text-sm text-slate-500">
          {filing.projectTitle} v{filing.versionNumber} · <span className="text-slate-300">{STATUS_LABEL[filing.status]}</span>
        </p>
      </div>

      {msg && <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">{msg}</p>}

      {filing.status === 'draft' && (
        <form onSubmit={submitData} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-semibold">Dados de titularidade e autoria</h2>
          {pricing && (
            <p className="text-xs text-slate-500">
              Honorários {money(pricing.serviceFeeCents)} + GRU código 730 {money(pricing.gruFeeCents)} = total{' '}
              {money(pricing.totalCents)} (cobrados separadamente).
            </p>
          )}
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={holderType === 'pf'} onChange={() => setHolderType('pf')} />
              Pessoa física
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={holderType === 'pj'} onChange={() => setHolderType('pj')} />
              Pessoa jurídica
            </label>
          </div>
          <input
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            placeholder={holderType === 'pf' ? 'CPF do titular' : 'CNPJ da empresa'}
            required
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
          />
          <input
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder={holderType === 'pf' ? 'Nome completo do titular' : 'Razão social'}
            required
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
          />
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Autores pessoa física (com CPF)</p>
            {authors.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={a.name}
                  onChange={(e) => setAuthors((xs) => xs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder="Nome do autor"
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
                />
                <input
                  value={a.cpf}
                  onChange={(e) => setAuthors((xs) => xs.map((x, j) => (j === i ? { ...x, cpf: e.target.value } : x)))}
                  placeholder="CPF"
                  className="w-40 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAuthors((xs) => [...xs, { name: '', cpf: '' }])}
              className="text-xs text-sky-400 hover:underline"
            >
              + adicionar autor
            </button>
          </div>
          <p className="text-xs text-amber-300">
            ⚠ Se o conteúdo foi produzido por terceiros ou funcionários, guarde o contrato de cessão/trabalho —
            a veracidade dos dados é responsabilidade legal do requerente.
          </p>
          <button
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Continuar →
          </button>
        </form>
      )}

      {filing.status === 'awaiting_poa' && (
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-semibold">Procuração</h2>
          {hasCert === null && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Você possui certificado digital qualificado ICP-Brasil (e-CPF ou e-CNPJ)?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setHasCert(true)} className="flex-1 rounded-lg bg-sky-500/20 px-4 py-2 text-sm text-sky-300">
                  Sim, eu tenho
                </button>
                <button onClick={() => setHasCert(false)} className="flex-1 rounded-lg border border-slate-800 px-4 py-2 text-sm">
                  Ainda não
                </button>
              </div>
            </div>
          )}

          {hasCert === false && (
            <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100">
              <p>
                Sem um certificado ICP-Brasil você não consegue assinar a procuração — o e-Software só aceita
                assinatura PAdES com e-CPF/e-CNPJ emitido por uma Autoridade Certificadora credenciada.
              </p>
              <p>Emita o seu junto a uma AC credenciada (ex.: Serasa, Certisign, Valid) e volte aqui.</p>
              <p className="text-xs text-amber-300">
                ⚠ Assinaturas eletrônicas avançadas (de plataformas como DocuSign/Clicksign) não são aceitas.
              </p>
              <button onClick={() => setHasCert(null)} className="text-xs text-sky-400 hover:underline">
                ← voltar
              </button>
            </div>
          )}

          {hasCert === true && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Baixe o modelo de procuração, assine digitalmente (PAdES) com seu certificado e envie o PDF assinado.
              </p>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPoaFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-400"
              />
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={signerDocType === 'e-cpf'} onChange={() => setSignerDocType('e-cpf')} />
                  e-CPF
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={signerDocType === 'e-cnpj'} onChange={() => setSignerDocType('e-cnpj')} />
                  e-CNPJ
                </label>
              </div>
              <input
                value={signerDocNumber}
                onChange={(e) => setSignerDocNumber(e.target.value)}
                placeholder="Número do documento do certificado usado na assinatura"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={sendPoa}
                disabled={busy || !poaFile || !signerDocNumber}
                className="w-full rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {busy ? 'Enviando…' : 'Enviar procuração assinada'}
              </button>
            </div>
          )}
        </section>
      )}

      {filing.status === 'awaiting_payment' && pricing && (
        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-semibold">Pagamento</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Honorários EduForge</dt>
              <dd>{money(pricing.serviceFeeCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">GRU código 730 (repasse)</dt>
              <dd>{money(pricing.gruFeeCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1 font-semibold">
              <dt>Total</dt>
              <dd>{money(pricing.totalCents)}</dd>
            </div>
          </dl>
          <button
            onClick={pay}
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {busy ? 'Processando…' : 'Confirmar pagamento'}
          </button>
        </section>
      )}

      {['in_review', 'filed', 'granted', 'rejected', 'revoked'].includes(filing.status) && (
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-semibold">Linha do tempo</h2>
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-2 text-sm">
                <span className="text-emerald-400">✓</span>
                <div>
                  <p className="text-slate-200">{EVENT_LABEL[e.kind] ?? e.kind}</p>
                  <p className="text-xs text-slate-500">{new Date(e.occurredAt).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            ))}
            {filing.status === 'filed' && (
              <div className="flex items-start gap-2 text-sm text-slate-500">
                <span>○</span>
                <p>Aguardando publicação na RPI (terças) — estimativa: até 8 dias corridos</p>
              </div>
            )}
          </div>

          {(filing.gruNumber || filing.inpiProcessNumber) && (
            <dl className="space-y-1 border-t border-slate-800 pt-3 text-sm">
              {filing.gruNumber && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Nosso número (GRU)</dt>
                  <dd>{filing.gruNumber}</dd>
                </div>
              )}
              {filing.inpiProcessNumber && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Processo INPI</dt>
                  <dd>{filing.inpiProcessNumber}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="border-t border-slate-800 pt-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Dossiê</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link
                href={`/projeto/${projectId}/inpi`}
                className="rounded-lg border border-slate-800 px-3 py-2 hover:border-slate-600"
              >
                ⬇ Pacote INPI
              </Link>
              {poaUrl && (
                <a href={poaUrl} className="rounded-lg border border-slate-800 px-3 py-2 hover:border-slate-600">
                  ⬇ Procuração
                </a>
              )}
              {certificateUrl ? (
                <a href={certificateUrl} className="rounded-lg border border-slate-800 px-3 py-2 hover:border-slate-600">
                  ⬇ Certificado
                </a>
              ) : (
                filing.status === 'filed' && (
                  <span className="rounded-lg border border-slate-800 px-3 py-2 text-slate-500">Certificado — pendente</span>
                )
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-3 text-sm">
            <a href="mailto:suporte@eduforge.app" className="text-sky-400 hover:underline">
              Falar com especialista
            </a>
            {canRevoke && (
              <button onClick={revoke} disabled={busy} className="text-rose-400 hover:underline disabled:opacity-50">
                Revogar procuração
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
