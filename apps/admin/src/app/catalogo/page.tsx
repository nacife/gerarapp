'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

interface PaletteItem { id: string; key: string; name: string; colors: unknown; wcagAa: boolean }
interface TemplateItem { id: string; key: string; name: string; tokens: unknown }

export default function CatalogoPage() {
  const router = useRouter();
  const [palettes, setPalettes] = useState<PaletteItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'palettes' | 'templates'>('palettes');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState('#06b6d4');
  const [secondary, setSecondary] = useState('#0891b2');
  const [accent, setAccent] = useState('#22d3ee');

  useEffect(() => {
    loadAll();
  }, [router]);

  async function loadAll() {
    const [pRes, tRes] = await Promise.all([
      apiFetch<PaletteItem[]>('/admin/catalog/palettes'),
      apiFetch<TemplateItem[]>('/admin/catalog/templates'),
    ]);
    if (pRes.status === 401) return router.replace('/entrar');
    if (pRes.ok && pRes.data) setPalettes(pRes.data);
    if (tRes.ok && tRes.data) setTemplates(tRes.data);
    setLoading(false);
  }

  async function createPalette(e: FormEvent) {
    e.preventDefault();
    const res = await apiFetch('/admin/catalog/palettes', {
      method: 'POST',
      body: { key, name, colors: { light: { primary, secondary, accent }, dark: { primary, secondary, accent } } },
    });
    if (res.ok) { setShowForm(false); loadAll(); }
  }

  async function deletePalette(id: string) {
    await apiFetch(`/admin/catalog/palettes/${id}`, { method: 'DELETE' });
    loadAll();
  }

  async function deleteTemplate(id: string) {
    await apiFetch(`/admin/catalog/templates/${id}`, { method: 'DELETE' });
    loadAll();
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-gray-400">Carregando…</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Catálogo (Templates & Paletas)</h1>
        <Link href="/" className="text-sm text-cyan-400 hover:underline">← Voltar</Link>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('palettes')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'palettes' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500 hover:text-gray-300'}`}>Paletas ({palettes.length})</button>
        <button onClick={() => setTab('templates')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'templates' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500 hover:text-gray-300'}`}>Templates ({templates.length})</button>
      </div>

      {tab === 'palettes' && (
        <>
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">{showForm ? 'Cancelar' : '+ Nova paleta'}</button>
          {showForm && (
            <form onSubmit={createPalette} className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <input value={key} onChange={e => setKey(e.target.value)} placeholder="Key (ex: meu-tema)" className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200 outline-none" required />
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome (ex: Meu Tema)" className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200 outline-none" required />
              <div className="flex gap-2">
                <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="h-10 w-16 rounded cursor-pointer" />
                <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)} className="h-10 w-16 rounded cursor-pointer" />
                <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="h-10 w-16 rounded cursor-pointer" />
              </div>
              <button type="submit" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950">Criar</button>
            </form>
          )}
          <div className="space-y-2">
            {palettes.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">{(p.colors as any)?.light?.primary && <><span className="h-5 w-5 rounded" style={{ background: (p.colors as any).light.primary }} /><span className="h-5 w-5 rounded" style={{ background: (p.colors as any).light.secondary }} /><span className="h-5 w-5 rounded" style={{ background: (p.colors as any).light.accent }} /></>}</div>
                  <div><p className="text-sm font-medium text-gray-200">{p.name}</p><p className="text-xs text-gray-500">{p.key} {p.wcagAa && '· WCAG AA ✓'}</p></div>
                </div>
                <button onClick={() => deletePalette(p.id)} className="text-xs text-red-400 hover:underline">Excluir</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'templates' && (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
              <div><p className="text-sm font-medium text-gray-200">{t.name}</p><p className="text-xs text-gray-500">{t.key}</p></div>
              <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-400 hover:underline">Excluir</button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
