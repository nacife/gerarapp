'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface Me {
  impersonatedBy?: { id: string; email: string } | null;
}

/** Faixa visível durante sessão de suporte (impersonação) — RF-12/US-ADM-01. */
export default function ImpersonationBanner() {
  const [admin, setAdmin] = useState<{ email: string } | null>(null);

  useEffect(() => {
    apiFetch<Me>('/auth/me').then((res) => {
      if (res.ok && res.data?.impersonatedBy) setAdmin(res.data.impersonatedBy);
    });
  }, []);

  async function endSession() {
    await apiFetch('/auth/logout', { method: 'POST' });
    window.location.href = '/entrar';
  }

  if (!admin) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        🔧 Sessão de suporte — acesso iniciado por <strong>{admin.email}</strong>
      </span>
      <button onClick={endSession} className="rounded bg-amber-950/20 px-2 py-0.5 text-xs hover:bg-amber-950/30">
        Encerrar sessão
      </button>
    </div>
  );
}
