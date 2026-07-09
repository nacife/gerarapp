import { useMemo, useState } from 'react';
import { gradeTimelineOrder, timelineCanonicalOrder, type Timeline } from '@eduforge/schemas';
import type { CompletionDetail, RuntimeTheme } from './theme';

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function TimelineView({
  payload,
  theme,
  onComplete,
}: {
  payload: Timeline;
  theme: RuntimeTheme;
  onComplete: (detail: CompletionDetail) => void;
}) {
  const canonical = useMemo(() => timelineCanonicalOrder(payload), [payload]);
  const [order, setOrder] = useState<string[]>(() =>
    payload.quiz_mode ? shuffle(canonical, canonical.length + payload.events.length) : canonical,
  );
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [read, setRead] = useState(false);

  const label = (id: string) => payload.events.find((e) => e.id === id)?.label_md ?? id;
  const detail = (id: string) => payload.events.find((e) => e.id === id)?.detail_md ?? '';

  function move(index: number, dir: -1 | 1) {
    const next = [...order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function submit() {
    const ok = gradeTimelineOrder(payload, order);
    setCorrect(ok);
    setSubmitted(true);
    onComplete({ correct: ok, order });
  }

  if (!payload.quiz_mode) {
    return (
      <div>
        <h4 className="mb-3 font-semibold" style={{ color: theme.text }}>
          {payload.title_md}
        </h4>
        <ol className="space-y-3 border-l-2 pl-4" style={{ borderColor: theme.border }}>
          {canonical.map((id) => (
            <li key={id}>
              <p className="text-sm font-medium" style={{ color: theme.primary }}>
                {label(id)}
              </p>
              <p className="text-xs" style={{ color: theme.muted }}>
                {detail(id)}
              </p>
            </li>
          ))}
        </ol>
        {!read && (
          <button
            onClick={() => {
              setRead(true);
              onComplete({ correct: true });
            }}
            style={{ background: theme.primary, color: theme.bg }}
            className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold"
          >
            Marcar como concluído
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm" style={{ color: theme.text }}>
        Reordene os eventos de &quot;{payload.title_md}&quot; cronologicamente.
      </p>
      <div className="space-y-2">
        {order.map((id, i) => (
          <div
            key={id}
            style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
          >
            <span>{label(id)}</span>
            <div className="flex gap-1">
              <button
                disabled={submitted || i === 0}
                onClick={() => move(i, -1)}
                style={{ color: theme.muted }}
                className="disabled:opacity-20"
              >
                ▲
              </button>
              <button
                disabled={submitted || i === order.length - 1}
                onClick={() => move(i, 1)}
                style={{ color: theme.muted }}
                className="disabled:opacity-20"
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>
      {!submitted ? (
        <button
          onClick={submit}
          style={{ background: theme.primary, color: theme.bg }}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Confirmar ordem
        </button>
      ) : (
        <p className="mt-3 text-sm" style={{ color: theme.muted }}>
          {correct ? 'Ordem correta!' : 'A ordem não está certa ainda.'}
        </p>
      )}
    </div>
  );
}
