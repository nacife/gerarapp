'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api';

interface Version {
  id: string;
  versionNumber: number;
  bundleSha512: string | null;
  publishedAt: string | null;
  active: boolean;
}

interface CertificateRow {
  id: string;
  versionNumber: number;
  algorithm: string;
  bundleHash: string;
  bundleHashSha256: string | null;
  generatedAt: string;
  lastVerification: { matched: boolean; verifiedAt: string } | null;
}

interface FichaRegistro {
  suggestedTitle: string;
  creationDate: string;
  publicationDate: string;
  languages: readonly string[];
  applicationField: string;
  programType: string;
  derivationText: string;
  algorithm: string;
  holderName: string;
}

interface CertificateDetail extends CertificateRow {
  zipUrl: string | null;
  declarationUrl: string | null;
  tsaUrl: string | null;
  fichaRegistro: FichaRegistro;
}

interface FilingSummary {
  id: string;
  inpiCertificateId: string | null;
  status: string;
}

function idempotencyKey(): string {
  return crypto.randomUUID();
}

export default function InpiPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const [versions, setVersions] = useState<Version[]>([]);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [detail, setDetail] = useState<CertificateDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [myFilings, setMyFilings] = useState<FilingSummary[]>([]);
  const [contracting, setContracting] = useState(false);

  async function load() {
    const [v, c, f] = await Promise.all([
      apiFetch<Version[]>(`/projects/${projectId}/versions`),
      apiFetch<CertificateRow[]>(`/projects/${projectId}/inpi/certificates`),
      apiFetch<FilingSummary[]>('/inpi/filings'),
    ]);
    if (v.status === 401) return router.replace('/entrar');
    if (v.ok && v.data) {
      setVersions(v.data);
      if (selectedVersion == null && v.data.length > 0) {
        setSelectedVersion(v.data.find((x) => x.active)?.versionNumber ?? v.data[0]!.versionNumber);
      }
    }
    if (c.ok && c.data) setCertificates(c.data);
    if (f.ok && f.data) setMyFilings(f.data);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  useEffect(() => {
    const existing = certificates.find((c) => c.versionNumber === selectedVersion);
    if (existing) void loadDetail(existing.id);
    else setDetail(null);
  }, [selectedVersion, certificates]);

  async function loadDetail(certId: string) {
    const res = await apiFetch<CertificateDetail>(`/inpi/certificates/${certId}`);
    if (res.ok && res.data) setDetail(res.data);
  }

  async function generate() {
    if (selectedVersion == null) return;
    setBusy(true);
    setMsg(null);
    setProgressLabel('Enfileirando…');
    const res = await apiFetch<{ jobId: string }>(`/projects/${projectId}/inpi/package`, {
      method: 'POST',
      body: { versionNumber: selectedVersion },
      headers: { 'Idempotency-Key': idempotencyKey() },
    });
    if (!res.ok || !res.data) {
      setBusy(false);
      setProgressLabel(null);
      setMsg(res.problem?.detail ?? 'Falha ao gerar o pacote INPI.');
      return;
    }
    const jobId = res.data.jobId;
    for (let i = 0; i < 180; i++) {
      const job = await apiFetch<{
        status: string;
        error?: string;
        progress?: { steps?: { label: string; status: string; pct: number }[] };
      }>(`/jobs/${jobId}`);
      const running = job.data?.progress?.steps?.find((s) => s.status === 'running');
      if (running) setProgressLabel(`${running.label}…`);
      if (job.data?.status === 'succeeded') break;
      if (job.data?.status === 'failed') {
        setMsg(job.data.error ?? 'Falha ao gerar o pacote INPI.');
        setBusy(false);
        setProgressLabel(null);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    setBusy(false);
    setProgressLabel(null);
    await load();
  }

  async function verify() {
    if (!detail) return;
    setBusy(true);
    const res = await apiFetch<{ matched: boolean; verifiedAt: string }>(
      `/inpi/certificates/${detail.id}/verify`,
      { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() } },
    );
    setBusy(false);
    if (res.ok && res.data) {
      setMsg(res.data.matched ? 'Íntegro — hash confere com o pacote congelado.' : '⚠ Divergência detectada no hash!');
      await loadDetail(detail.id);
    } else {
      setMsg(res.problem?.detail ?? 'Falha ao verificar.');
    }
  }

  function copyHash(hash: string) {
    void navigator.clipboard.writeText(hash);
    setMsg('Hash copiado.');
  }

  async function contract() {
    if (!detail) return;
    setContracting(true);
    setMsg(null);
    const res = await apiFetch<{ filing: { id: string } }>('/inpi/filings', {
      method: 'POST',
      body: { certificateId: detail.id },
      headers: { 'Idempotency-Key': idempotencyKey() },
    });
    setContracting(false);
    if (res.ok && res.data) {
      router.push(`/projeto/${projectId}/inpi/assistido/${res.data.filing.id}`);
    } else {
      setMsg(res.problem?.detail ?? 'Falha ao contratar o Registro Assistido.');
    }
  }

  const activeFiling = detail
    ? myFilings.find((f) => f.inpiCertificateId === detail.id && !['revoked', 'rejected'].includes(f.status))
    : undefined;

  if (!loaded) {
    return <main className="grid min-h-screen place-items-center text-slate-400">Carregando…</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <Link href={`/projeto/${projectId}/revisar`} className="text-sm text-sky-400 hover:underline">
          ← revisão e publicação
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Registro INPI</h1>
      </div>

      <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-100">
        <p>
          ⓘ O INPI recebe apenas o resumo hash — não o código-fonte. A guarda do arquivo ZIP original é
          responsabilidade do titular (a EduForge mantém uma cópia como redundância, não como
          substituição), por até 50 anos.
        </p>
        <p>
          A Declaração de Veracidade e a procuração exigem certificado digital qualificado ICP-Brasil
          (e-CPF/e-CNPJ) com assinatura PAdES — certificados "avançados" não são aceitos pelo e-Software.
        </p>
        <p>
          Uma nova versão com mudanças substanciais pode exigir um novo registro (obra derivada). O
          registro protege a expressão do programa, não a ideia; o título não é protegido por ele.
        </p>
        <p>Esta tela não presta consultoria jurídica — o pedido no e-Software é de responsabilidade do titular.</p>
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-slate-500">Publique uma versão do app para gerar a certificação INPI.</p>
      ) : (
        <>
          <label className="block text-sm">
            <span className="text-slate-400">Versão para registro</span>
            <select
              value={selectedVersion ?? ''}
              onChange={(e) => setSelectedVersion(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 outline-none"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.versionNumber}>
                  v{v.versionNumber}
                  {v.active ? ' — ativa' : ''}
                  {v.publishedAt ? ` — publicada em ${new Date(v.publishedAt).toLocaleDateString('pt-BR')}` : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="font-semibold">Autosserviço</h2>
              <p className="text-xs text-slate-500">Gere o pacote e registre você mesmo no e-Software.</p>
              <ul className="space-y-1 text-xs text-slate-400">
                <li>• ZIP código-fonte + documentação</li>
                <li>• Hash SHA-512 + Ficha de Registro</li>
                <li>• Declaração de Integridade (PDF)</li>
              </ul>
              <button
                onClick={generate}
                disabled={busy || !!detail}
                className="w-full rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {busy ? (progressLabel ?? 'Processando…') : detail ? 'Já certificado' : 'Gerar pacote'}
              </button>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="font-semibold">Registro Assistido</h2>
              <p className="text-xs text-slate-500">
                Tudo do autosserviço + procuração, GRU, protocolo no e-Software e acompanhamento na RPI.
              </p>
              <ul className="space-y-1 text-xs text-slate-400">
                <li>• Revisão documental por especialista</li>
                <li>• EduForge atua como procuradora</li>
                <li>• Você só assina a procuração e paga</li>
              </ul>
              {activeFiling ? (
                <Link
                  href={`/projeto/${projectId}/inpi/assistido/${activeFiling.id}`}
                  className="block w-full rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-center text-sm font-semibold text-sky-300 hover:bg-sky-500/20"
                >
                  Ver meu pedido →
                </Link>
              ) : (
                <button
                  onClick={contract}
                  disabled={!detail || contracting}
                  title={!detail ? 'Gere o pacote (autosserviço) desta versão primeiro' : undefined}
                  className="w-full rounded-lg border border-slate-800 px-4 py-2 text-sm hover:border-slate-600 disabled:opacity-40"
                >
                  {contracting ? 'Contratando…' : 'Contratar'}
                </button>
              )}
            </section>
          </div>

          {msg && <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">{msg}</p>}

          {detail && (
            <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
                  Certificação — v{detail.versionNumber}
                </h2>
                {detail.lastVerification && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      detail.lastVerification.matched
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {detail.lastVerification.matched ? '✓ Íntegro' : '⚠ Divergente'} — verif. em{' '}
                    {new Date(detail.lastVerification.verifiedAt).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs text-slate-500">SHA-512</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate text-xs text-slate-300">{detail.bundleHash}</code>
                  <button onClick={() => copyHash(detail.bundleHash)} className="shrink-0 text-xs text-sky-400 hover:underline">
                    copiar
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-sm">
                {detail.zipUrl && (
                  <a href={detail.zipUrl} className="rounded-lg border border-slate-800 px-3 py-2 hover:border-slate-600">
                    ⬇ ZIP
                  </a>
                )}
                {detail.declarationUrl && (
                  <a href={detail.declarationUrl} className="rounded-lg border border-slate-800 px-3 py-2 hover:border-slate-600">
                    ⬇ Declaração
                  </a>
                )}
                {detail.tsaUrl && (
                  <a href={detail.tsaUrl} className="rounded-lg border border-slate-800 px-3 py-2 hover:border-slate-600">
                    ⬇ Carimbo .tst
                  </a>
                )}
                <button
                  onClick={verify}
                  disabled={busy}
                  className="rounded-lg border border-slate-800 px-3 py-2 hover:border-slate-600 disabled:opacity-50"
                >
                  Verificar integridade
                </button>
              </div>

              <div className="space-y-2 border-t border-slate-800 pt-4">
                <h3 className="text-sm font-medium uppercase tracking-wider text-slate-500">
                  Ficha de Registro (apoio ao e-Software)
                </h3>
                <dl className="space-y-1.5 text-sm">
                  <Field label="Título sugerido" value={detail.fichaRegistro.suggestedTitle} />
                  <Field label="Data de criação" value={detail.fichaRegistro.creationDate} />
                  <Field label="Data de publicação" value={detail.fichaRegistro.publicationDate} />
                  <Field label="Linguagens" value={detail.fichaRegistro.languages.join(', ')} />
                  <Field label="Campo de aplicação" value={detail.fichaRegistro.applicationField} />
                  <Field label="Tipo de programa" value={detail.fichaRegistro.programType} />
                  <Field label="Titular declarado" value={detail.fichaRegistro.holderName} />
                </dl>
                <div>
                  <p className="text-xs text-slate-500">Derivação autorizada</p>
                  <p className="mt-1 text-xs text-slate-400">{detail.fichaRegistro.derivationText}</p>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right text-slate-300">{value}</dd>
    </div>
  );
}
