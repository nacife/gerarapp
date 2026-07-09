'use client';

import { type FormEvent, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiFetch } from '../../lib/api';

export default function SignupPage() {
  const t = useTranslations('auth.signup');
  const te = useTranslations('auth.errors');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accept) return setError(te('acceptTerms'));
    setLoading(true);
    const res = await apiFetch('/auth/signup', {
      method: 'POST',
      body: { name, email, password, acceptTerms: true },
    });
    setLoading(false);
    if (!res.ok) return setError(res.problem?.detail ?? te('generic'));
    setDone(true);
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

        {done ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <p className="text-lg font-semibold">✓ {t('title')}</p>
            <p className="mt-2 text-sm text-slate-300">{t('success', { email })}</p>
            <Link href="/entrar" className="mt-4 inline-block text-sky-400 hover:underline">
              {t('loginLink')} →
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
              <p className="mt-1 text-sm text-slate-400">{t('subtitle')}</p>
            </div>
            <label className="block text-sm">
              <span className="text-slate-400">{t('name')}</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-500"
              />
            </label>
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
              <span className="mt-1 block text-xs text-slate-500">{t('passwordHint')}</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
                className="mt-1"
              />
              <span>{t('terms')}</span>
            </label>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? t('submitting') : t('submit')}
            </button>
            <p className="text-center text-sm text-slate-400">
              {t('hasAccount')}{' '}
              <Link href="/entrar" className="text-sky-400 hover:underline">
                {t('loginLink')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
