'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface AuditEntry {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeAfter: unknown;
  createdAt: string;
}

export default function AuditoriaPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AuditEntry[]>('/admin/audit-logs').then((res) => {
      if (res.status === 401) return router.replace('/entrar');
      if (res.ok && res.data) setLogs(res.data);
      setLoading(false);
    });
  }, [router]);

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Auditoria Global</h1>
        <Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link>
      </div>

      <p className="text-sm text-gray-500">Últimas {logs.length} ações administrativas registradas.</p>

      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-4 rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 text-sm">
            <span className="shrink-0 rounded bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
              {log.action}
            </span>
            <div className="flex-1">
              <span className="text-gray-400">
                {log.actorRole} → {log.targetType}:{log.targetId.slice(0, 8)}…
              </span>
            </div>
            <span className="text-xs text-gray-600">
              {new Date(log.createdAt).toLocaleString('pt-BR')}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-center text-gray-500 py-8">Nenhum registro de auditoria encontrado.</p>
        )}
      </div>
    </main>
  );
}
