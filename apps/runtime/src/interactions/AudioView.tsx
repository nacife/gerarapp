import { useEffect, useState } from 'react';
import type { Audio } from '@eduforge/schemas';
import type { CompletionDetail, RuntimeTheme } from './theme';

const SPEAKER_LABEL: Record<string, string> = { narrator: 'Narrador', host_a: 'Apresentador A', host_b: 'Apresentadora B' };

/**
 * Síntese de voz real (TTS/podcast) é RF-06.5 — Fase 2/M10. Aqui simulamos o
 * player exibindo a transcrição, com marcação de "ouvido" para progresso.
 */
export function AudioView({
  payload,
  theme,
  onComplete,
}: {
  payload: Audio;
  theme: RuntimeTheme;
  onComplete: (detail: CompletionDetail) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const duration = payload.duration_s ?? 60;

  useEffect(() => {
    if (!playing || done) return;
    const id = setInterval(() => {
      setProgress((p) => Math.min(100, p + 100 / duration));
    }, 1000);
    return () => clearInterval(id);
  }, [playing, done, duration]);

  useEffect(() => {
    if (progress >= 100 && !done) {
      setDone(true);
      setPlaying(false);
      onComplete({ correct: true, listened: true });
    }
  }, [progress, done, onComplete]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={done}
          style={{ background: theme.primary, color: theme.bg }}
          className="grid h-10 w-10 place-items-center rounded-full font-bold disabled:opacity-50"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: theme.surface }}>
          <div style={{ width: `${progress}%`, background: theme.accent }} className="h-full transition-all" />
        </div>
        <span className="text-xs" style={{ color: theme.muted }}>
          {payload.variant === 'podcast' ? 'Podcast' : 'Resumo'}
        </span>
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
        {payload.transcript.map((line, i) => (
          <p key={i} style={{ color: theme.muted }}>
            <strong style={{ color: theme.text }}>{SPEAKER_LABEL[line.speaker] ?? line.speaker}:</strong> {line.text}
          </p>
        ))}
      </div>
      {!done && (
        <button
          onClick={() => {
            setDone(true);
            setPlaying(false);
            onComplete({ correct: true, listened: true, skipped: true });
          }}
          style={{ color: theme.muted }}
          className="mt-2 text-xs underline"
        >
          Marcar como ouvido
        </button>
      )}
    </div>
  );
}
