'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  locale: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  impersonatedBy?: { id: string; email: string } | null;
}

interface SessionRow {
  id: string;
  device: { ip?: string; userAgent?: string } | null;
  expiresAt: string;
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [name, setName] = useState('');
  const [locale, setLocale] = useState('pt-BR');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState('');

  async function load() {
    const [meRes, sessRes] = await Promise.all([
      apiFetch<Me>('/auth/me'),
      apiFetch<SessionRow[]>('/auth/sessions'),
    ]);
    if (!meRes.ok || !meRes.data) return router.replace('/entrar');
    setMe(meRes.data);
    setName(meRes.data.name);
    setLocale(meRes.data.locale);
    if (sessRes.ok && sessRes.data) setSessions(sessRes.data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await apiFetch('/auth/profile', { method: 'PATCH', body: { name, locale } });
    setBusy(false);
    setMsg(res.ok ? 'Perfil atualizado.' : (res.problem?.detail ?? 'Falha ao salvar.'));
    if (res.ok) await load();
  }

  async function startMfaSetup() {
    const res = await apiFetch<{ secret: string }>('/auth/mfa/setup', { method: 'POST' });
    if (res.ok && res.data) setMfaSecret(res.data.secret);
  }

  async function enableMfa(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await apiFetch<{ backupCodes: string[] }>('/auth/mfa/enable', {
      method: 'POST',
      body: { code: mfaCode },
    });
    setBusy(false);
    if (!res.ok || !res.data) return setMsg(res.problem?.detail ?? 'Código inválido.');
    // O cookie de acesso emitido antes do MFA não carrega mfa:true — renova para refletir o novo estado.
    await apiFetch('/auth/refresh', { method: 'POST' });
    setBackupCodes(res.data.backupCodes);
  }

  async function finishMfaSetup() {
    setMfaSecret(null);
    setMfaCode('');
    setBackupCodes(null);
    await load();
  }

  async function disableMfa(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await apiFetch('/auth/mfa/disable', { method: 'POST', body: { code: disableCode } });
    setBusy(false);
    setDisableCode('');
    setMsg(res.ok ? 'MFA desativado.' : (res.problem?.detail ?? 'Código inválido.'));
    if (res.ok) {
      await apiFetch('/auth/refresh', { method: 'POST' });
      await load();
    }
  }

  async function revokeSession(id: string) {
    await apiFetch(`/auth/sessions/${id}`, { method: 'DELETE' });
    await load();
  }

  async function exportData() {
    const res = await apiFetch<Record<string, unknown>>('/account/export');
    if (!res.ok || !res.data) return setMsg('Falha ao exportar dados.');
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meus-dados-eduforge.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (!window.confirm('Isso agenda a exclusão (anonimização) da sua conta. Continuar?')) return;
    const res = await apiFetch('/account/delete', { method: 'POST' });
    setMsg(res.ok ? 'Exclusão agendada.' : (res.problem?.detail ?? 'Falha ao solicitar exclusão.'));
  }

  if (!me) {
    return <main className="grid min-h-screen place-items-center text-slate-400">Carregando…</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/painel" className="text-sm text-sky-400 hover:underline">
          ← painel
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Configurações</h1>
      </div>

      {msg && <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">{msg}</p>}

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Perfil</h2>
        <form onSubmit={saveProfile} className="space-y-3">
          <label className="block text-sm">
            <span className="text-slate-400">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 outline-none focus:border-sky-500"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Idioma</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 outline-none"
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
            </select>
          </label>
          <p className="text-xs text-slate-500">E-mail: {me.email}</p>
          <button
            disabled={busy}
            className="rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Salvar
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Autenticação em duas etapas</h2>
        {me.mfaEnabled ? (
          <>
            <p className="text-sm text-emerald-400">✓ MFA ativo</p>
            <form onSubmit={disableMfa} className="flex items-center gap-2">
              <input
                inputMode="numeric"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="Código de 6 dígitos"
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
              />
              <button
                disabled={busy}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 disabled:opacity-50"
              >
                Desativar MFA
              </button>
            </form>
          </>
        ) : mfaSecret ? (
          backupCodes ? (
            <div>
              <p className="text-sm font-medium">Guarde seus códigos de backup</p>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((c) => (
                  <span key={c} className="rounded bg-slate-950 px-2 py-1 text-center">
                    {c}
                  </span>
                ))}
              </div>
              <button
                onClick={finishMfaSetup}
                className="mt-4 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Concluir
              </button>
            </div>
          ) : (
            <form onSubmit={enableMfa} className="space-y-3">
              <p className="text-xs text-slate-400">Adicione este segredo ao seu app autenticador:</p>
              <code className="block break-all rounded bg-slate-950 px-3 py-2 font-mono text-sm text-emerald-300">
                {mfaSecret}
              </code>
              <input
                autoFocus
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Código de 6 dígitos"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-center tracking-[0.3em] outline-none"
              />
              <button
                disabled={busy}
                className="w-full rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                Ativar MFA
              </button>
            </form>
          )
        ) : (
          <button
            onClick={startMfaSetup}
            className="rounded-lg border border-slate-800 px-4 py-2 text-sm hover:border-slate-600"
          >
            Configurar MFA
          </button>
        )}
      </section>

      <section className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Sessões ativas</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma sessão ativa.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
              >
                <div>
                  <p className="text-slate-300">{s.device?.userAgent ?? 'Dispositivo desconhecido'}</p>
                  <p className="text-xs text-slate-500">
                    {s.device?.ip ?? '—'} · expira em {new Date(s.expiresAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button onClick={() => revokeSession(s.id)} className="text-xs text-rose-400 hover:underline">
                  Encerrar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Desenvolvedores</h2>
        <p className="text-sm text-slate-400">
          API keys e webhooks para integrar o EduForge aos seus sistemas (API pública /v1).
        </p>
        <Link
          href="/configuracoes/api"
          className="inline-block rounded-lg border border-slate-800 px-4 py-2 text-sm hover:border-slate-600"
        >
          Gerenciar API e Webhooks →
        </Link>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Privacidade (LGPD)</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportData}
            className="rounded-lg border border-slate-800 px-4 py-2 text-sm hover:border-slate-600"
          >
            Baixar meus dados
          </button>
          <button
            onClick={deleteAccount}
            disabled={!!me.impersonatedBy}
            title={me.impersonatedBy ? 'Indisponível durante sessão de suporte' : undefined}
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
          >
            Excluir minha conta
          </button>
        </div>
      </section>
    </main>
  );
}
