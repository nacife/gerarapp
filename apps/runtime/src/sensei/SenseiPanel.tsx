import { type FormEvent, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { RuntimeTheme } from '../interactions/theme';

interface SenseiConfig {
  config: { name: string; avatar: string; tone: string };
  indexed: boolean;
}

interface AskOutput {
  answer: string;
  citations: { blockId: string; sourceRef: { page?: number } }[];
  refused: boolean;
  tutor: { name: string; avatar: string; tone: string };
}

interface ChatMessage {
  question: string;
  answer: string;
  citations: { blockId: string; sourceRef: { page?: number } }[];
  refused: boolean;
  tutor: { name: string; avatar: string };
}

const MODES: { key: string; label: string }[] = [
  { key: 'default', label: 'Responder' },
  { key: 'explain_different', label: 'Explique diferente' },
  { key: 'test_me', label: 'Me teste' },
  { key: 'socratic', label: 'Modo socrático' },
];

export function SenseiPanel({
  slug,
  enrollmentId,
  theme,
}: {
  slug: string;
  enrollmentId: string | null;
  theme: RuntimeTheme;
}) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<{ name: string; avatar: string; indexed: boolean } | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Carrega config do Sensei ao abrir.
  useEffect(() => {
    if (!open || config) return;
    apiFetch<SenseiConfig>(`/public/apps/${encodeURIComponent(slug)}/sensei`).then((res) => {
      if (res.ok && res.data) {
        setConfig({ name: res.data.config.name, avatar: res.data.config.avatar, indexed: res.data.indexed });
      }
    });
  }, [open, config, slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading || !enrollmentId) return;
    setLoading(true);
    setError(null);
    setQuestion('');

    const res = await apiFetch<AskOutput>(`/public/enrollments/${enrollmentId}/sensei/ask`, {
      method: 'POST',
      body: { question: q, mode },
    });

    if (res.ok && res.data) {
      setHistory((prev) => [
        ...prev,
        {
          question: q,
          answer: res.data!.answer,
          citations: res.data!.citations,
          refused: res.data!.refused,
          tutor: res.data!.tutor,
        },
      ]);
    } else {
      const msg = res.status === 402
        ? 'Créditos de IA do criador esgotados.'
        : res.status === 409
          ? 'Conteúdo ainda não indexado. Publique o app para habilitar o Sensei.'
          : res.problem?.detail ?? 'Erro ao consultar o Sensei.';
      setError(msg);
    }

    setLoading(false);
  }

  const avatar = config?.avatar ?? '🤖';
  const name = config?.name ?? 'Sensei';

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(!open)}
        style={{ background: theme.accent, color: theme.bg }}
        className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-transform hover:scale-105"
        title={`Conversar com ${name}`}
      >
        <span className="text-xl">{avatar}</span>
        <span className="text-sm font-semibold">{name}</span>
      </button>

      {/* Painel de chat */}
      {open && (
        <div
          style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
          className="fixed right-4 bottom-20 z-50 flex h-[500px] w-96 flex-col rounded-xl border shadow-2xl"
        >
          {/* Cabeçalho */}
          <div
            style={{ background: theme.accent, color: theme.bg }}
            className="flex items-center justify-between rounded-t-xl px-4 py-3 font-semibold"
          >
            <span>{avatar} {name}</span>
            <button onClick={() => setOpen(false)} className="text-lg leading-none opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>

          {/* Histórico */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!config?.indexed && (
              <div style={{ background: theme.border }} className="rounded-lg p-3 text-center text-sm">
                ⚠️ Conteúdo ainda não indexado. Peça ao criador que publique o app.
              </div>
            )}
            {history.map((msg, i) => (
              <div key={i} className="space-y-1">
                <div style={{ background: theme.border }} className="ml-8 rounded-lg p-2 text-sm">
                  {msg.question}
                </div>
                <div
                  className={`rounded-lg p-2 text-sm ${msg.refused ? 'border border-orange-500/50 bg-orange-500/10' : ''}`}
                >
                  <p className="whitespace-pre-wrap">{msg.answer}</p>
                  {msg.refused && (
                    <p className="mt-1 text-xs text-orange-400">
                      O Sensei recusou — a pergunta está fora do escopo do material.
                    </p>
                  )}
                  {msg.citations.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {msg.citations.map((c, j) => (
                        <span
                          key={j}
                          style={{ background: theme.accent, color: theme.bg }}
                          className="rounded px-1.5 py-0.5 text-xs"
                        >
                          {c.sourceRef?.page ? `p. ${c.sourceRef.page}` : '📖'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="animate-pulse text-sm" style={{ color: theme.muted }}>
                {name} está pensando…
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-2 text-sm text-red-400">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleAsk}
            style={{ borderColor: theme.border }}
            className="flex flex-col gap-2 border-t p-3"
          >
            {/* Chips de modo */}
            <div className="flex flex-wrap gap-1">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  style={{
                    background: mode === m.key ? theme.accent : theme.border,
                    color: mode === m.key ? theme.bg : theme.text,
                  }}
                  className="rounded-full px-2 py-0.5 text-xs transition-colors"
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={`Pergunte ao ${name}…`}
                disabled={loading || !config?.indexed}
                style={{ background: theme.bg, borderColor: theme.border, color: theme.text }}
                className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none disabled:opacity-50"
                minLength={3}
                maxLength={500}
              />
              <button
                type="submit"
                disabled={loading || !question.trim() || !config?.indexed}
                style={{ background: theme.accent, color: theme.bg }}
                className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
