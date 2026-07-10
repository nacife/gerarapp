import { useEffect, useRef, useState } from 'react';
import type { Audio } from '@eduforge/schemas';
import type { CompletionDetail, RuntimeTheme } from './theme';

const SPEAKER_LABEL: Record<string, string> = { narrator: 'Narrador', host_a: 'Apresentador A', host_b: 'Apresentadora B' };
const SPEEDS = [1, 1.25, 1.5, 2];

export function AudioView({ payload, theme, onComplete }: { payload: Audio; theme: RuntimeTheme; onComplete: (detail: CompletionDetail) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [done, setDone] = useState(false);
  const [hasRealAudio, setHasRealAudio] = useState(false);

  useEffect(() => {
    if (audioRef.current && payload.media_asset_id && payload.media_asset_id !== '22222222-2222-2222-2222-222222222222') {
      // Áudio real disponível via media asset
      setHasRealAudio(true);
    }
  }, [payload.media_asset_id]);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(() => {}); setPlaying(true); }
  }

  function handleSpeed(s: number) { setSpeed(s); if (audioRef.current) audioRef.current.playbackRate = s; }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button onClick={togglePlay} disabled={done} style={{ background: theme.primary, color: theme.bg }} className="grid h-10 w-10 place-items-center rounded-full font-bold disabled:opacity-50">
          {playing ? '⏸' : '▶'}
        </button>
        <div className="flex-1">
          {hasRealAudio ? (
            <audio ref={audioRef} src={`/api/v1/public/media/${payload.media_asset_id}/stream`} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setDone(true); setPlaying(false); onComplete({ correct: true, listened: true }); }} />
          ) : (
            <SimulatedProgress playing={playing} duration={payload.duration_s ?? 60} theme={theme} onDone={() => { setDone(true); setPlaying(false); onComplete({ correct: true, listened: true }); }} />
          )}
          <span className="text-xs" style={{ color: theme.muted }}>{payload.variant === 'podcast' ? 'Podcast' : 'Resumo'}</span>
        </div>
      </div>

      {/* Velocidade */}
      {hasRealAudio && (
        <div className="mb-2 flex gap-1">{SPEEDS.map(s => <button key={s} onClick={() => handleSpeed(s)} className="rounded px-2 py-0.5 text-xs" style={{ background: speed === s ? theme.accent : 'transparent', color: speed === s ? theme.bg : theme.muted, border: `1px solid ${theme.border}` }}>{s}x</button>)}</div>
      )}

      {/* Transcrição */}
      <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
        {payload.transcript.map((line, i) => <p key={i} style={{ color: theme.muted }}><strong style={{ color: theme.text }}>{SPEAKER_LABEL[line.speaker] ?? line.speaker}:</strong> {line.text}</p>)}
      </div>

      {!done && (
        <button onClick={() => { setDone(true); setPlaying(false); onComplete({ correct: true, listened: true, skipped: true }); }} style={{ color: theme.muted }} className="mt-2 text-xs underline">Marcar como ouvido</button>
      )}
    </div>
  );
}

function SimulatedProgress({ playing, duration, theme, onDone }: { playing: boolean; duration: number; theme: RuntimeTheme; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setProgress(p => { const n = p + 100 / duration; if (n >= 100) { clearInterval(id); setTimeout(onDone, 100); } return Math.min(100, n); }), 1000);
    return () => clearInterval(id);
  }, [playing, duration, onDone]);
  return <div className="h-1.5 overflow-hidden rounded-full" style={{ background: theme.surface }}><div style={{ width: `${progress}%`, background: theme.accent }} className="h-full transition-all" /></div>;
}
