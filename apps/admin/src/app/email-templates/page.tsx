'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface Template { subject: string; body: string }

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, [router]);
  async function load() {
    const res = await apiFetch<Record<string, Template>>('/admin/email-templates');
    if (res.status === 401) return router.replace('/entrar');
    if (res.ok && res.data) setTemplates(res.data);
    setLoading(false);
  }

  function edit(key: string, t: Template) { setEditKey(key); setSubject(t.subject); setBody(t.body); }

  async function save() {
    if (!editKey) return;
    await apiFetch('/admin/email-templates', { method: 'POST', body: { key: editKey, subject, body } });
    setMsg(`${editKey} salvo.`); setTimeout(() => setMsg(null), 2000);
    setEditKey(null); load();
  }

  const LABELS: Record<string, string> = { welcome: 'Boas-vindas', 'verify-email': 'Verificação de e-mail', 'password-reset': 'Redefinição de senha', certificate: 'Certificado', invite: 'Convite' };

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-gray-100">Templates de E-mail</h1><Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link></div>
      {msg && <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-sm text-cyan-300">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {Object.entries(templates).map(([key, t]) => (
            <button key={key} onClick={() => edit(key, t)} className={`w-full rounded-lg border p-3 text-left transition ${editKey === key ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08]'}`}>
              <p className="text-sm font-medium text-gray-200">{LABELS[key] ?? key}</p>
              <p className="text-xs text-gray-500 truncate">{t.subject}</p>
            </button>
          ))}
        </div>

        {editKey && (
          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h2 className="font-semibold text-gray-200">{LABELS[editKey] ?? editKey}</h2>
            <div><label className="text-xs text-gray-500">Assunto</label><input value={subject} onChange={e => setSubject(e.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200" /></div>
            <div><label className="text-xs text-gray-500">Corpo (HTML)</label><textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200 font-mono" /></div>
            <p className="text-xs text-gray-600">Variáveis: {'{{name}} {{link}} {{projectTitle}}'}</p>
            <button onClick={save} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">Salvar</button>
          </div>
        )}
      </div>
    </main>
  );
}
