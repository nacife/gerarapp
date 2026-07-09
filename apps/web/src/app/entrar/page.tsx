'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiFetch } from '../../lib/api';

interface LoginResponse {
  mfaRequired: boolean;
  challengeToken?: string;
  user?: { name: string };
}

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const te = useTranslations('auth.errors');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setLoading(false);
    if (!res.ok) return setError(res.problem?.detail ?? te('generic'));
    if (res.data?.mfaRequired && res.data.challengeToken) {
      setChallengeToken(res.data.challengeToken);
      return;
    }
    router.push('/painel');
  }

  async function submitMfa(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await apiFetch('/auth/login/mfa', {
      method: 'POST',
      body: { challengeToken, code },
    });
    setLoading(false);
    if (!res.ok) return setError(res.problem?.detail ?? te('generic'));
    router.push('/painel');
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 font-black text-slate-950">
            E
          </span>
          <span className="font-semibold tracking-tight">EduForge</span>
        </Link>

        {challengeToken ? (
          <form onSubmit={submitMfa} className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('mfaTitle')}</h1>
              <p className="mt-1 text-sm text-slate-400">{t('mfaSubtitle')}</p>
            </div>
            <input
              autoFocus
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('mfaCode')}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-sky-500"
            />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? t('submitting') : t('mfaSubmit')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitLogin} className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
              <p className="mt-1 text-sm text-slate-400">{t('subtitle')}</p>
            </div>
            <label className="block text-sm">
              <span className="text-slate-400">{t('email')}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-500"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">{t('password')}</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-500"
              />
            </label>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? t('submitting') : t('submit')}
            </button>
            <p className="text-center text-sm text-slate-400">
              {t('noAccount')}{' '}
              <Link href="/cadastro" className="text-sky-400 hover:underline">
                {t('signupLink')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
