'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

export default function ImpersonarPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setError('Link de sessão de suporte inválido ou expirado.');
      return;
    }
    apiFetch('/auth/impersonate/consume', { method: 'POST', body: { token } }).then((res) => {
      if (res.ok) {
        router.replace('/painel');
      } else {
        setError(res.problem?.detail ?? 'Link de sessão de suporte inválido ou expirado.');
      }
    });
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      {error ? (
        <div>
          <p className="text-rose-400">{error}</p>
        </div>
      ) : (
        <p className="text-slate-400">Iniciando sessão de suporte…</p>
      )}
    </main>
  );
}
