import { useMemo, useState } from 'react';
import { gradeHotspot, type Hotspot } from '@eduforge/schemas';
import type { CompletionDetail, RuntimeTheme } from './theme';

export function HotspotView({
  payload,
  theme,
  onComplete,
}: {
  payload: Hotspot;
  theme: RuntimeTheme;
  onComplete: (detail: CompletionDetail) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  // Pergunta fixa (determinística) no quiz_mode: o primeiro spot da lista.
  const askedSpot = useMemo(() => (payload.quiz_mode ? payload.spots[0] : null), [payload]);

  function click(spotId: string) {
    if (submitted) return;
    if (payload.quiz_mode) {
      const ok = gradeHotspot(askedSpot!.id, spotId);
      setCorrect(ok);
      setSubmitted(true);
      setActive(spotId);
      onComplete({ correct: ok, clicked: spotId, asked: askedSpot!.id });
      return;
    }
    setActive(spotId);
    const next = new Set(viewed).add(spotId);
    setViewed(next);
    if (next.size === payload.spots.length) {
      onComplete({ correct: true, viewed: [...next] });
    }
  }

  const activeSpot = payload.spots.find((s) => s.id === active);

  return (
    <div>
      {payload.quiz_mode && !submitted && (
        <p className="mb-2 text-sm" style={{ color: theme.text }}>
          Clique onde fica: <strong>{askedSpot!.label_md}</strong>
        </p>
      )}
      <div
        className="relative aspect-video w-full overflow-hidden rounded-xl border"
        style={{ background: theme.surface, borderColor: theme.border }}
        role="img"
        aria-label={payload.image_alt ?? 'Diagrama interativo'}
      >
        {payload.spots.map((spot) => {
          const [x, y] = spot.coords;
          const isViewed = viewed.has(spot.id) || active === spot.id;
          return (
            <button
              key={spot.id}
              onClick={() => click(spot.id)}
              aria-label={spot.label_md}
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                background: isViewed ? theme.accent : theme.primary,
                borderColor: theme.bg,
              }}
              className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow transition hover:scale-110"
            />
          );
        })}
      </div>
      {activeSpot && (
        <div className="mt-3 text-sm">
          <p className="font-semibold" style={{ color: theme.primary }}>
            {activeSpot.label_md}
          </p>
          <p style={{ color: theme.muted }}>{activeSpot.detail_md}</p>
        </div>
      )}
      {submitted && (
        <p className="mt-2 text-sm" style={{ color: theme.muted }}>
          {correct ? 'Correto!' : `Não era esse — era "${askedSpot!.label_md}".`}
        </p>
      )}
    </div>
  );
}
