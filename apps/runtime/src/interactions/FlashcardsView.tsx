import { useState } from 'react';
import type { FlashcardDeck } from '@eduforge/schemas';
import type { CompletionDetail, RuntimeTheme } from './theme';
import { usePrefersReducedMotion } from '../effects/reduced-motion';

const RATINGS: { label: string; quality: number }[] = [
  { label: 'Esqueci', quality: 1 },
  { label: 'Difícil', quality: 3 },
  { label: 'Bom', quality: 4 },
  { label: 'Fácil', quality: 5 },
];

export function FlashcardsView({
  payload,
  theme,
  onComplete,
}: {
  payload: FlashcardDeck;
  theme: RuntimeTheme;
  onComplete: (detail: CompletionDetail) => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<number[]>([]);
  const [mastered, setMastered] = useState(false);
  const reduced = usePrefersReducedMotion();
  const card = payload.cards[index];
  const done = index >= payload.cards.length;

  function rate(quality: number) {
    const next = [...ratings, quality];
    setRatings(next);
    if (index + 1 >= payload.cards.length) {
      const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
      if (avg >= 4) setMastered(true); // domínio → efeito holo
      onComplete({ correct: avg >= 3, quality: avg });
    } else {
      setIndex(index + 1);
      setFlipped(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm" style={{ color: theme.muted }}>
        Baralho revisado — {payload.cards.length} cartões.
      </p>
    );
  }

  const cardClass = mastered
    ? 'card-holo'
    : reduced
      ? ''
      : 'card-3d';

  return (
    <div>
      <p className="mb-2 text-xs" style={{ color: theme.muted }}>
        Cartão {index + 1} de {payload.cards.length}
      </p>

      <style>{`
        .card-3d {
          perspective: 600px;
        }
        .card-3d-inner {
          transition: transform 0.4s ease;
          transform-style: preserve-3d;
        }
        .card-3d-inner.flipped {
          transform: rotateY(180deg);
        }
        .card-front, .card-back {
          backface-visibility: hidden;
        }
        .card-back {
          transform: rotateY(180deg);
        }
        @keyframes holo-shimmer {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .card-holo {
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.06) 0%,
            rgba(255,255,255,0.15) 25%,
            rgba(255,215,0,0.12) 50%,
            rgba(255,255,255,0.15) 75%,
            rgba(255,255,255,0.06) 100%
          );
          background-size: 200% 200%;
          animation: holo-shimmer 2.5s ease infinite;
          border-color: rgba(255, 215, 0, 0.35) !important;
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.15);
        }
        @media (prefers-reduced-motion: reduce) {
          .card-3d-inner { transition: none; }
          .card-holo { animation: none; }
        }
      `}</style>

      <button
        onClick={() => setFlipped((f) => !f)}
        style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
        className={`card-3d flex min-h-[120px] w-full items-center justify-center rounded-xl border text-center text-lg font-medium ${cardClass}`}
      >
        <div className={`card-3d-inner flex w-full items-center justify-center ${flipped ? 'flipped' : ''}`}>
          <div className="card-front p-6">
            {card!.front_md}
          </div>
          <div className="card-back absolute inset-0 flex items-center justify-center p-6">
            {card!.back_md}
          </div>
        </div>
      </button>

      <p className="mt-2 text-center text-xs" style={{ color: theme.muted }}>
        {flipped ? 'Verso' : 'Clique para virar'}
      </p>

      {flipped && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.label}
              onClick={() => rate(r.quality)}
              style={{ background: theme.primary, color: theme.bg }}
              className="rounded-lg px-2 py-2 text-xs font-semibold"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
