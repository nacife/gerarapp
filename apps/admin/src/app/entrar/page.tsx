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
      </form>
    </main>
  );
}
