import { useState } from 'react';
import { gradeCloze, type Cloze } from '@eduforge/schemas';
import type { CompletionDetail, RuntimeTheme } from './theme';

export function ClozeView({
  payload,
  theme,
  onComplete,
}: {
  payload: Cloze;
  theme: RuntimeTheme;
  onComplete: (detail: CompletionDetail) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<Record<string, boolean>>({});

  const parts = payload.text_template_md.split(/(\{\{gap:[a-z0-9]+\}\})/gi);

  function submit() {
    const graded = gradeCloze(payload, answers);
    setResult(graded.perGap);
    setSubmitted(true);
    onComplete({ correct: graded.allCorrect, answers });
  }

  return (
    <div>
      <p className="mb-3 text-sm leading-relaxed" style={{ color: theme.text }}>
        {parts.map((part, i) => {
          const match = part.match(/\{\{gap:([a-z0-9]+)\}\}/i);
          if (!match) return <span key={i}>{part}</span>;
          const gapId = match[1];
          const gap = payload.gaps.find((g) => g.id === gapId);
          const isCorrect = result[gapId];
          if (gap?.input === 'word_bank') {
            return (
              <select
                key={i}
                disabled={submitted}
                value={answers[gapId] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [gapId]: e.target.value }))}
                style={{
                  background: theme.surface,
                  borderColor: submitted ? (isCorrect ? theme.accent : '#f87171') : theme.border,
                  color: theme.text,
                }}
                className="mx-1 rounded border px-2 py-0.5"
              >
                <option value="">…</option>
                {[...(gap.answers ?? []), ...(payload.word_bank_distractors ?? [])].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            );
          }
          return (
            <input
              key={i}
              disabled={submitted}
              value={answers[gapId] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [gapId]: e.target.value }))}
              style={{
                background: theme.surface,
                borderColor: submitted ? (isCorrect ? theme.accent : '#f87171') : theme.border,
                color: theme.text,
              }}
              className="mx-1 w-28 rounded border px-2 py-0.5"
            />
          );
        })}
      </p>
      {!submitted ? (
        <button
          onClick={submit}
          style={{ background: theme.primary, color: theme.bg }}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Verificar
        </button>
      ) : (
        <p className="text-sm" style={{ color: theme.muted }}>
          {Object.values(result).every(Boolean) ? 'Tudo certo!' : 'Algumas respostas precisam de revisão.'}
        </p>
      )}
    </div>
  );
}
