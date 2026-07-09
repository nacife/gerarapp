import { useRef, useState } from 'react';
import type { RuntimeTheme } from '../interactions/theme';

const SPEEDS = [1, 1.25, 1.5, 2];

interface TranscriptLine {
  speaker: string;
  text: string;
}

interface PodcastMeta {
  title?: string;
  transcript?: TranscriptLine[];
  durationSec?: number;
}

const SPEAKER_LABEL: Record<string, string> = {
  A: 'Apresentador A',
  B: 'Apresentadora B',
};

/** Player de podcast com velocidade variável e transcrição (RF-06.5). */
export function PodcastPlayer({
  url,
  meta,
  theme,
}: {
  url: string;
  meta: PodcastMeta;
  theme: RuntimeTheme;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);

  function handleSpeedChange(s: number) {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  }

  return (
    <div
      style={{ background: theme.surface, borderColor: theme.border }}
      className="rounded-xl border p-4 space-y-3"
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          style={{ background: theme.accent, color: theme.bg }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: theme.text }}>
            {meta.title ?? 'Podcast'}
          </p>
          {meta.durationSec != null && (
            <p className="text-xs" style={{ color: theme.muted }}>
              {Math.floor(meta.durationSec / 60)}:{String(Math.floor(meta.durationSec % 60)).padStart(2, '0')}
            </p>
          )}
        </div>
      </div>

      {/* Áudio (oculto, controlado via JS) */}
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* Controle de velocidade */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: theme.muted }}>Velocidade:</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => handleSpeedChange(s)}
            style={{
              background: speed === s ? theme.accent : theme.border,
              color: speed === s ? theme.bg : theme.text,
            }}
            className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors"
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Transcrição */}
      {meta.transcript && meta.transcript.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs" style={{ color: theme.muted }}>
            Ver transcrição ({meta.transcript.length} falas)
          </summary>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
            {meta.transcript.map((line, i) => (
              <p key={i} style={{ color: theme.muted }}>
                <strong style={{ color: theme.text }}>
                  {SPEAKER_LABEL[line.speaker] ?? line.speaker}:
                </strong>{' '}
                {line.text}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
