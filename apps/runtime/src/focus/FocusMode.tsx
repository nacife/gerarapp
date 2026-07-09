import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../effects/reduced-motion';
import type { RuntimeTheme } from '../interactions/theme';

/**
 * Modo Foco Neuro-adaptativo (RF-06.6):
 * - Fonte OpenDyslexic para dislexia
 * - RSVP (Rapid Serial Visual Presentation) — leitura palavra por palavra
 * - Régua de leitura (highlight de linha ativa)
 * - Redução de estímulos (dim background)
 * - Pausas ativas sugeridas a cada 5 min
 *
 * Tudo respeita `prefers-reduced-motion`.
 */
export function FocusMode({
  contentMd,
  theme,
}: {
  contentMd: string;
  theme: RuntimeTheme;
}) {
  const reduced = usePrefersReducedMotion();
  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [rsvpActive, setRsvpActive] = useState(false);
  const [rsvpIndex, setRsvpIndex] = useState(0);
  const [rulerActive, setRulerActive] = useState(false);
  const [dimBg, setDimBg] = useState(false);
  const [rsvpSpeed, setRsvpSpeed] = useState(250); // ms por palavra
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Extrai palavras do conteúdo
  const words = contentMd
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>\[\]]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  // RSVP — avança palavra a palavra
  useEffect(() => {
    if (!rsvpActive || reduced) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setRsvpIndex(0);
    timerRef.current = setInterval(() => {
      setRsvpIndex((i) => {
        if (i + 1 >= words.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          setRsvpActive(false);
          return i;
        }
        return i + 1;
      });
    }, rsvpSpeed);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [rsvpActive, rsvpSpeed, reduced]);

  // Pausa ativa a cada 5 min de RSVP
  const [pauseReminder, setPauseReminder] = useState(false);
  useEffect(() => {
    if (!rsvpActive) return;
    const id = setTimeout(() => setPauseReminder(true), 5 * 60 * 1000);
    return () => clearTimeout(id);
  }, [rsvpActive]);

  return (
    <div className={`space-y-3 ${dyslexicFont ? 'font-dyslexic' : ''}`}>
      <style>{`
        @font-face {
          font-family: 'OpenDyslexic';
          src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/otf/OpenDyslexic-Regular.otf') format('opentype');
          font-display: swap;
        }
        .font-dyslexic { font-family: 'OpenDyslexic', sans-serif; }
        .rsvp-word {
          font-size: 2rem;
          font-weight: 600;
          transition: opacity 0.1s;
        }
        .reading-ruler {
          background: linear-gradient(transparent 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.08) 55%, transparent 100%);
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .rsvp-word { transition: none; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2" style={{ borderColor: theme.border, background: theme.surface }}>
        <span className="text-xs font-semibold" style={{ color: theme.muted }}>Modo Foco:</span>

        <button
          onClick={() => setDyslexicFont(!dyslexicFont)}
          style={{
            background: dyslexicFont ? theme.accent : theme.border,
            color: dyslexicFont ? theme.bg : theme.text,
          }}
          className="rounded-full px-2.5 py-1 text-xs transition-colors"
        >
          {dyslexicFont ? 'OpenDyslexic ✓' : 'Fonte p/ dislexia'}
        </button>

        <button
          onClick={() => { setRsvpActive(!rsvpActive); setPauseReminder(false); }}
          style={{
            background: rsvpActive ? theme.accent : theme.border,
            color: rsvpActive ? theme.bg : theme.text,
          }}
          className="rounded-full px-2.5 py-1 text-xs transition-colors"
        >
          {rsvpActive ? 'RSVP ativo' : 'Leitura rápida (RSVP)'}
        </button>

        <button
          onClick={() => setRulerActive(!rulerActive)}
          style={{
            background: rulerActive ? theme.accent : theme.border,
            color: rulerActive ? theme.bg : theme.text,
          }}
          className="rounded-full px-2.5 py-1 text-xs transition-colors"
        >
          {rulerActive ? 'Régua ✓' : 'Régua de leitura'}
        </button>

        <button
          onClick={() => setDimBg(!dimBg)}
          style={{
            background: dimBg ? theme.accent : theme.border,
            color: dimBg ? theme.bg : theme.text,
          }}
          className="rounded-full px-2.5 py-1 text-xs transition-colors"
        >
          {dimBg ? 'Modo escuro ✓' : 'Reduzir estímulos'}
        </button>

        {rsvpActive && (
          <select
            value={rsvpSpeed}
            onChange={(e) => setRsvpSpeed(Number(e.target.value))}
            style={{ background: theme.surface, color: theme.text, borderColor: theme.border }}
            className="rounded-full border px-2 py-1 text-xs"
          >
            <option value={350}>Lento (350ms)</option>
            <option value={250}>Normal (250ms)</option>
            <option value={150}>Rápido (150ms)</option>
          </select>
        )}
      </div>

      {/* Pausa ativa */}
      {pauseReminder && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-300">
          🧘 Pausa ativa sugerida! Você está lendo há 5 minutos.
          Respire fundo, pisque os olhos e alongue o pescoço por 30 segundos.
          <button
            onClick={() => setPauseReminder(false)}
            className="ml-2 underline"
          >
            Voltar
          </button>
        </div>
      )}

      {/* RSVP Viewer */}
      {rsvpActive && words.length > 0 && (
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border p-8" style={{ borderColor: theme.border, background: dimBg ? theme.bg : theme.surface }}>
          <div className="text-center">
            <span className="rsvp-word" style={{ color: theme.text }}>
              {words[rsvpIndex]}
            </span>
            <div className="mt-2 text-xs" style={{ color: theme.muted }}>
              {rsvpIndex + 1} / {words.length} palavras
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo normal (não RSVP) */}
      {!rsvpActive && (
        <div
          className={`prose max-w-none rounded-xl p-6 ${rulerActive ? 'reading-ruler' : ''}`}
          style={{ background: dimBg ? theme.bg : theme.surface, color: theme.text, borderColor: theme.border }}
        >
          {contentMd.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i} className="mb-3 text-2xl font-bold" style={{ color: theme.primary }}>{line.slice(2)}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="mb-2 mt-4 text-xl font-semibold">{line.slice(3)}</h2>;
            if (line.trim() === '') return <br key={i} />;
            return <p key={i} className="mb-1 leading-relaxed">{line}</p>;
          })}
        </div>
      )}
    </div>
  );
}
