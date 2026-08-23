'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch } from '../../lib/api';

interface LoginResponse {
  mfaRequired: boolean;
  challengeToken?: string;
}

export default function AdminLoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitSocial(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await apiFetch<LoginResponse>('/auth/social/mock/exchange', {
      method: 'POST',
      body: { code: 'mock_oauth_code_google_user' },
    });
    setLoading(false);
    if (!res.ok) return setError(t('error'));
    if (res.data?.mfaRequired && res.data.challengeToken) {
      setChallengeToken(res.data.challengeToken);
      return;
    }
    router.push('/');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (challengeToken) {
      const res = await apiFetch('/auth/login/mfa', {
        method: 'POST',
        body: { challengeToken, code },
      });
      setLoading(false);
      if (!res.ok) return setError(t('error'));
      router.push('/');
      return;
    }
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setLoading(false);
    if (!res.ok) return setError(t('error'));
    if (res.data?.mfaRequired && res.data.challengeToken) {
      setChallengeToken(res.data.challengeToken);
      return;
    }
    router.push('/');
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="mb-2 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 font-black text-zinc-950">
            E
          </span>
          <div>
            <h1 className="font-semibold">{t('title')}</h1>
            <p className="text-xs text-zinc-500">{t('subtitle')}</p>
          </div>
        </div>

        {challengeToken ? (
          <input
            autoFocus
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de 6 dígitos"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-center tracking-[0.3em] outline-none focus:border-zinc-500"
          />
        ) : (
          <>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('email')}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-zinc-500"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('password')}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-zinc-500"
            />
          </>
        )}

        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-lg bg-zinc-100 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-60"
        >
          {loading ? t('submitting') : t('submit')}
        </button>

        <div className="relative my-4 flex items-center py-2">
          <div className="flex-grow border-t border-zinc-800"></div>
          <span className="flex-shrink-0 px-4 text-xs text-zinc-500 uppercase">ou</span>
          <div className="flex-grow border-t border-zinc-800"></div>
        </div>
        <button
          type="button"
          onClick={submitSocial}
          disabled={loading}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"
            />
          </svg>
          Google (Mock)
        </button>
      </form>
    </main>
  );
}
