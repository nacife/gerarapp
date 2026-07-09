import { useState } from 'react';
import { gradeDragdrop, type Dragdrop } from '@eduforge/schemas';
import type { CompletionDetail, RuntimeTheme } from './theme';

function ItemRow({
  label,
  theme,
  onUp,
  onDown,
}: {
  label: string;
  theme: RuntimeTheme;
  onUp?: () => void;
  onDown?: () => void;
}) {
  return (
    <div
      style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
    >
      <span>{label}</span>
      <div className="flex gap-1">
        <button
          onClick={onUp}
          disabled={!onUp}
          aria-label="Mover para cima"
          style={{ color: theme.muted }}
          className="disabled:opacity-20"
        >
          ▲
        </button>
        <button
          onClick={onDown}
          disabled={!onDown}
          aria-label="Mover para baixo"
          style={{ color: theme.muted }}
          className="disabled:opacity-20"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

export function DragDropView({
  payload,
  theme,
  onComplete,
}: {
  payload: Dragdrop;
  theme: RuntimeTheme;
  onComplete: (detail: CompletionDetail) => void;
}) {
  const [order, setOrder] = useState<string[]>(payload.items.map((i) => i.id));
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  function move(index: number, dir: -1 | 1) {
    const next = [...order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function submit() {
    const submission =
      payload.variant === 'ordering' ? { order } : { mapping };
    const ok = gradeDragdrop(payload, submission);
    setCorrect(ok);
    setSubmitted(true);
    onComplete({ correct: ok, ...submission });
  }

  const label = (id: string) => payload.items.find((i) => i.id === id)?.label_md ?? id;

  return (
    <div>
      <p className="mb-3 text-sm" style={{ color: theme.text }}>
        {payload.prompt_md}
      </p>

      {payload.variant === 'ordering' ? (
        <div className="space-y-2">
          {order.map((id, i) => (
            <ItemRow
              key={id}
              label={label(id)}
              theme={theme}
              onUp={submitted ? undefined : i > 0 ? () => move(i, -1) : undefined}
              onDown={submitted ? undefined : i < order.length - 1 ? () => move(i, 1) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {payload.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span style={{ color: theme.text }}>{item.label_md}</span>
              <select
                disabled={submitted}
                value={mapping[item.id] ?? ''}
                onChange={(e) => setMapping((m) => ({ ...m, [item.id]: e.target.value }))}
                style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
                className="rounded border px-2 py-1"
              >
                <option value="">…</option>
                {(payload.targets ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label_md}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {!submitted ? (
        <button
          onClick={submit}
          style={{ background: theme.primary, color: theme.bg }}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Confirmar
        </button>
      ) : (
        <p className="mt-3 text-sm" style={{ color: theme.muted }}>
          {correct ? 'Correto!' : 'Não foi dessa vez — reveja a seção.'}
        </p>
      )}
    </div>
  );
}
