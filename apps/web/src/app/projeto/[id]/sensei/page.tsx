'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api';

interface SenseiConfigData {
  name: string;
  avatar: string;
  tone: string;
}

interface Chapter {
  id: string;
  title: string;
}

interface MediaItem {
  id: string;
  kind: string;
  meta: unknown;
  url: string;
}

const EMOJIS = ['🤖', '🧑‍🏫', '👩‍🏫', '🧬', '🎓', '📚', '💡', '🌟', '🦉', '🧪'];
const TONES: { key: string; label: string }[] = [
  { key: 'formal', label: 'Formal' },
  { key: 'descontraido', label: 'Descontraído' },
  { key: 'motivador', label: 'Motivador' },
];

export default function SenseiPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();

  const [name, setName] = useState('Sensei');
  const [avatar, setAvatar] = useState('🤖');
  const [tone, setTone] = useState('formal');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);

  const [generatingPodcast, setGeneratingPodcast] = useState<string | null>(null);
  const [generatingIllustration, setGeneratingIllustration] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    loadChapters();
    loadMedia();
  }, [projectId]);

  async function loadConfig() {
    const res = await apiFetch<SenseiConfigData>(`/projects/${projectId}/sensei`);
    if (res.status === 401) return router.replace('/entrar');
    if (res.ok && res.data) {
      setName(res.data.name);
      setAvatar(res.data.avatar);
      setTone(res.data.tone);
    }
  }

  async function loadChapters() {
    const res = await apiFetch<{ tree: Chapter[] }>(`/projects/${projectId}/content-map`);
    if (res.ok && res.data?.tree) {
      setChapters(res.data.tree);
    }
  }

  async function loadMedia() {
    const res = await apiFetch<MediaItem[]>(`/projects/${projectId}/media`);
    if (res.ok && res.data) setMedia(res.data);
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const res = await apiFetch<SenseiConfigData>(`/projects/${projectId}/sensei`, {
      method: 'PUT',
      body: { name, avatar, tone },
    });
    setSaving(false);
    if (res.ok) setMsg('Configuração salva.');
    else setMsg(res.problem?.detail ?? 'Erro ao salvar.');
  }

  async function generatePodcast(chapterId: string) {
    setGeneratingPodcast(chapterId);
    const res = await apiFetch<{ jobId: string }>(
      `/projects/${projectId}/chapters/${chapterId}/podcast`,
      { method: 'POST' },
    );
    setGeneratingPodcast(null);
    if (res.ok) {
      setMsg('Podcast enfileirado. Aguarde a geração…');
      setTimeout(() => loadMedia(), 3000);
    } else {
      setMsg(res.problem?.detail ?? 'Erro ao gerar podcast.');
    }
  }

  async function generateIllustration(chapterId: string) {
    setGeneratingIllustration(chapterId);
    const res = await apiFetch<{ mediaAssetId: string; alt: string }>(
      `/projects/${projectId}/chapters/${chapterId}/illustration`,
      { method: 'POST' },
    );
    setGeneratingIllustration(null);
    if (res.ok) {
      setMsg('Ilustração gerada!');
      loadMedia();
    } else {
      setMsg(res.problem?.detail ?? 'Erro ao gerar ilustração.');
    }
  }

  function mediaForChapter(chapterId: string) {
    return media.filter((m) => {
      const meta = m.meta as Record<string, unknown> | null;
      return meta?.chapterId === chapterId;
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Sensei (Tutor IA)</h1>
        <Link href={`/projeto/${projectId}/revisar`} className="text-sm text-sky-400 hover:underline">
          ← Voltar
        </Link>
      </div>

      {/* Config */}
      <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-200">Personalidade do tutor</h2>

        <div>
          <label className="mb-1 block text-sm text-slate-400">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-400">Avatar</label>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setAvatar(e)}
                className={`rounded-lg border px-3 py-1.5 text-xl transition-colors ${
                  avatar === e
                    ? 'border-sky-400 bg-sky-500/20'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-400">Tom</label>
          <div className="flex gap-2">
            {TONES.map((t) => (
              <button
                key={t.key}
                onClick={() => setTone(t.key)}
                className={`rounded-lg border px-4 py-1.5 text-sm transition-colors ${
                  tone === t.key
                    ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          {msg && <span className="text-sm text-slate-400">{msg}</span>}
        </div>
      </section>

      {/* Capítulos e mídia */}
      <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-200">Mídia por capítulo</h2>
        <p className="text-sm text-slate-400">
          Gere podcasts e ilustrações para cada capítulo do mapa aprovado.
          Custo: 5 créditos por podcast, 2 créditos por ilustração.
        </p>

        {chapters.length === 0 && (
          <p className="text-sm text-slate-500">Nenhum capítulo no mapa aprovado.</p>
        )}

        <div className="space-y-3">
          {chapters.map((ch) => {
            const chapterMedia = mediaForChapter(ch.id);
            const podcast = chapterMedia.find((m) => m.kind === 'tts');
            const illustration = chapterMedia.find((m) => m.kind === 'ai_generated');

            return (
              <div
                key={ch.id}
                className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-2"
              >
                <h3 className="font-medium text-slate-200">{ch.title}</h3>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => generatePodcast(ch.id)}
                    disabled={generatingPodcast === ch.id}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
                  >
                    {generatingPodcast === ch.id ? 'Enfileirando…' : podcast ? '🎧 Regenerar podcast' : '🎧 Gerar podcast (5 créd.)'}
                  </button>

                  <button
                    onClick={() => generateIllustration(ch.id)}
                    disabled={generatingIllustration === ch.id}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
                  >
                    {generatingIllustration === ch.id ? 'Gerando…' : illustration ? '🎨 Regenerar ilustração' : '🎨 Gerar ilustração (2 créd.)'}
                  </button>
                </div>

                {/* Previews */}
                {podcast && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs text-slate-500">Podcast:</p>
                    <audio controls className="w-full" style={{ maxHeight: 32 }}>
                      <source src={podcast.url} type="audio/wav" />
                    </audio>
                  </div>
                )}
                {illustration && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs text-slate-500">Ilustração:</p>
                    <img
                      src={illustration.url}
                      alt={(illustration.meta as any)?.alt ?? 'Ilustração do capítulo'}
                      className="max-h-48 rounded-lg border border-slate-700"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
