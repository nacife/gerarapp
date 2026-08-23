'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api';

type Colors = Record<string, string>;
interface Template {
  id: string;
  key: string;
  name: string;
}
interface Palette {
  id: string;
  key: string;
  name: string;
  colors: { light: Colors; dark: Colors };
}

export default function VisualPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [template, setTemplate] = useState('modern');
  const [palette, setPalette] = useState<{ light: Colors; dark: Colors } | null>(null);
  const [dark, setDark] = useState(false);
  const [logo, setLogo] = useState('#0ea5e9');
  const [access, setAccess] = useState('public');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Enviar tema para o iframe
  useEffect(() => {
    if (!iframeRef.current || !palette || !template) return;
    const tpl = templates.find((t) => t.key === template);
    iframeRef.current.contentWindow?.postMessage(
      {
        type: 'UPDATE_THEME',
        theme: dark ? palette.dark : palette.light,
        templateConfig: tpl,
      },
      '*',
    );
  }, [palette, dark, template, templates]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PREVIEW_READY' && palette) {
        const tpl = templates.find((t) => t.key === template);
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'UPDATE_THEME',
            theme: dark ? palette.dark : palette.light,
            templateConfig: tpl,
          },
          '*',
        );
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [palette, dark, template, templates]);

  useEffect(() => {
    (async () => {
      const [tpls, pals, theme] = await Promise.all([
        apiFetch<Template[]>('/templates'),
        apiFetch<Palette[]>('/palettes'),
        apiFetch<{ templateKey: string; palette: { light: Colors; dark: Colors } }>(
          `/projects/${projectId}/theme`,
        ),
      ]);
      if (tpls.status === 401) return router.replace('/entrar');
      if (tpls.ok && tpls.data) setTemplates(tpls.data);
      if (pals.ok && pals.data) {
        setPalettes(pals.data);
        if (theme.ok && theme.data) {
          setTemplate(theme.data.templateKey);
          setPalette(theme.data.palette);
        } else if (pals.data[0]) {
          setPalette(pals.data[0].colors);
        }
      }
    })();
  }, [projectId, router]);

  async function fromLogo() {
    const res = await apiFetch<{ palette: { light: Colors; dark: Colors }; adjusted: string[] }>(
      `/projects/${projectId}/theme/from-logo`,
      { method: 'POST', body: { brand: logo } },
    );
    if (res.ok && res.data) {
      setPalette(res.data.palette);
      setMsg(
        res.data.adjusted.length
          ? `Paleta derivada da marca. Ajustes WCAG AA em: ${res.data.adjusted.join(', ')}`
          : 'Paleta derivada da marca (todas as combinações já passam em AA).',
      );
    }
  }

  async function save(): Promise<boolean> {
    if (!palette) return false;
    setBusy(true);
    const [themeRes, accessRes] = await Promise.all([
      apiFetch(`/projects/${projectId}/theme`, {
        method: 'PUT',
        body: { template, palette, typography: {}, effects: {} },
      }),
      apiFetch(`/projects/${projectId}/access`, {
        method: 'PUT',
        body: { mode: access, password: access === 'password' ? password : undefined },
      }),
    ]);
    setBusy(false);
    return themeRes.ok && accessRes.ok;
  }

  async function saveAndContinue() {
    const ok = await save();
    if (ok) router.push(`/projeto/${projectId}/interacoes`);
    else setMsg('Falha ao salvar tema/acesso.');
  }

  const c = palette ? (dark ? palette.dark : palette.light) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <header>
        <p className="text-xs uppercase tracking-wider text-slate-500">
          ①Upload — ②Mapa — <span className="text-sky-400">③Visual</span> — ④Interações — ⑤Revisão
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Estúdio visual</h1>
        <Link href={`/projeto/${projectId}/mapa`} className="text-sm text-sky-400 hover:underline">
          ← mapa
        </Link>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-slate-500">
              Template
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.key)}
                  className={`rounded-xl border p-3 text-left text-sm transition ${
                    template === t.key
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-slate-500">
              Paleta <span className="text-emerald-400">✓ WCAG AA</span>
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {palettes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPalette(p.colors)}
                  title={p.name}
                  className="rounded-lg border border-slate-800 p-2 hover:border-slate-600"
                >
                  <div className="flex gap-1">
                    {['primary', 'secondary', 'accent'].map((k) => (
                      <span
                        key={k}
                        className="h-4 flex-1 rounded"
                        style={{ background: p.colors.light[k] }}
                      />
                    ))}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">{p.name}</p>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="color"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                className="h-9 w-12 rounded border border-slate-800 bg-transparent"
              />
              <button
                onClick={fromLogo}
                className="rounded-lg border border-slate-800 px-3 py-2 text-sm hover:border-slate-600"
              >
                Extrair paleta da marca
              </button>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-slate-500">
              Acesso
            </h2>
            <select
              value={access}
              onChange={(e) => setAccess(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="public">Público</option>
              <option value="link">Link secreto</option>
              <option value="password">Senha</option>
            </select>
            {access === 'password' && (
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha do app"
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
              />
            )}
          </section>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Prévia</h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1">
                <button
                  onClick={() => setDevice('mobile')}
                  className={`px-2 py-1 text-xs rounded ${device === 'mobile' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  📱
                </button>
                <button
                  onClick={() => setDevice('tablet')}
                  className={`px-2 py-1 text-xs rounded ${device === 'tablet' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  💻
                </button>
                <button
                  onClick={() => setDevice('desktop')}
                  className={`px-2 py-1 text-xs rounded ${device === 'desktop' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  🖥️
                </button>
              </div>
              <button
                onClick={() => setDark((d) => !d)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
              >
                {dark ? '🌙 escuro' : '☀️ claro'}
              </button>
            </div>
          </div>

          <div className="flex justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div
              className="overflow-hidden rounded-xl border border-slate-700 shadow-2xl transition-all duration-300"
              style={{
                width: device === 'mobile' ? '375px' : device === 'tablet' ? '768px' : '100%',
                height: '600px',
              }}
            >
              <iframe
                ref={iframeRef}
                src="http://localhost:5173/preview"
                className="h-full w-full border-none bg-white"
                title="App Preview"
              />
            </div>
          </div>

          <button
            onClick={saveAndContinue}
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Salvando…' : 'Salvar e continuar → interações'}
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="w-full rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:border-slate-600"
          >
            Salvar rascunho
          </button>
          {msg && <p className="text-sm text-slate-400">{msg}</p>}
        </div>
      </div>
    </main>
  );
}
