'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiFetch } from '../lib/api';

const ADMIN_ROLES = ['admin', 'super_admin', 'support'];

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
}

const panels = [
  { title: 'Dashboard do Sistema', hint: 'Saúde, filas, estatísticas em tempo real', tag: 'Admin 1', href: '/sistema' },
  { title: 'Usuários & Organizações', hint: 'Buscar, suspender, sessões, impersonar, papel', tag: 'M6', href: '/usuarios' },
  { title: 'Feature Flags', hint: 'Rollout %, por usuário/plano', tag: 'M6', href: '/flags' },
  { title: 'Fila INPI', hint: 'Protocolo e-Software, checklist, concessão', tag: 'M8', href: '/inpi' },
  { title: 'Auditoria', hint: 'Logs globais de ações administrativas', tag: 'Admin 1', href: '/auditoria' },
  { title: 'Configuração de APIs', hint: 'Rate limits, créditos IA, endpoints, ambiente', tag: 'Admin 1', href: '/config' },
];

type Phase = 'loading' | 'denied' | 'mfa' | 'console';

export default function AdminHome() {
  const t = useTranslations('gate');
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await apiFetch<Me>('/auth/me');
    if (!res.ok || !res.data) {
      router.replace('/entrar');
      return;
    }
    setMe(res.data);
    if (!ADMIN_ROLES.includes(res.data.role)) {
      setPhase('denied');
      return;
    }
    if (!res.data.mfaEnabled) {
      const setup = await apiFetch<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup', {
        method: 'POST',
      });
      if (setup.ok && setup.data) setSecret(setup.data.secret);
      setPhase('mfa');
      return;
    }
    setPhase('console');
  }

  useEffect(() => {
    void load();
  }, []);

  async function enableMfa(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await apiFetch<{ backupCodes: string[] }>('/auth/mfa/enable', {
      method: 'POST',
      body: { code },
    });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.problem?.detail ?? 'Código inválido.');
    setBackupCodes(res.data.backupCodes);
  }

  /** O token de acesso emitido no login carrega `mfa:false` — precisa ser renovado
   *  após ativar o MFA para que os endpoints protegidos por MFA parem de barrar. */
  async function continueToConsole() {
    await apiFetch('/auth/refresh', { method: 'POST' });
    await load();
  }

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    router.replace('/entrar');
  }

  if (phase === 'loading') {
    return <main className="grid min-h-screen place-items-center text-zinc-500">{t('loading')}</main>;
  }

  if (phase === 'denied') {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-rose-400">{t('denied')}</p>
          <button onClick={logout} className="mt-4 text-sm text-zinc-400 underline">
            Sair
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'mfa') {
    return (
      <main className="grid min-h-screen place-items-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <h1 className="text-xl font-bold text-amber-200">🔒 {t('mfaTitle')}</h1>
          <p className="mt-2 text-sm text-zinc-300">{t('mfaBody')}</p>

          {backupCodes ? (
            <div className="mt-5">
              <p className="text-sm font-medium">{t('backupTitle')}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((c) => (
                  <span key={c} className="rounded bg-zinc-900 px-2 py-1 text-center">
                    {c}
                  </span>
                ))}
              </div>
              <button
                onClick={() => void continueToConsole()}
                className="mt-5 w-full rounded-lg bg-zinc-100 px-4 py-3 font-semibold text-zinc-950"
              >
                {t('continue')}
              </button>
            </div>
          ) : (
            <form onSubmit={enableMfa} className="mt-5 space-y-3">
              <p className="text-xs text-zinc-400">{t('secretLabel')}</p>
              <code className="block break-all rounded bg-zinc-900 px-3 py-2 font-mono text-sm text-emerald-300">
                {secret ?? '…'}
              </code>
              <input
                autoFocus
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('codeLabel')}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-center tracking-[0.3em] outline-none focus:border-zinc-500"
              />
              {error && <p className="text-sm text-rose-400">{error}</p>}
              <button
                disabled={busy}
                className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60"
              >
                {busy ? t('enabling') : t('enable')}
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  // phase === 'console'
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-14">
      <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 font-black text-zinc-950">
            E
          </span>
          <div>
            <p className="font-semibold">EduForge Admin</p>
            <p className="text-xs text-zinc-500">{me?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
            MFA ✓ ativo
          </span>
          <button onClick={logout} className="text-sm text-zinc-400 hover:text-white">
            Sair
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {panels.map((p) => (
          <Link
            key={p.title}
            href={p.href!}
            className="flex items-start justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-cyan-500/30 hover:bg-white/[0.04]"
          >
            <div>
              <p className="font-semibold text-gray-200">{p.title}</p>
              <p className="mt-1 text-sm text-gray-500">{p.hint}</p>
            </div>
            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">{p.tag}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
