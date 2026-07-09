import { useState } from 'react';
import { gradeQuiz, type Quiz } from '@eduforge/schemas';
import type { CompletionDetail, RuntimeTheme } from './theme';

export function QuizView({
  payload,
  theme,
  onComplete,
}: {
  payload: Quiz;
  theme: RuntimeTheme;
  onComplete: (detail: CompletionDetail) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  function toggle(id: string) {
    if (submitted) return;
    if (payload.mode === 'single' || payload.mode === 'true_false') {
      setSelected([id]);
    } else {
      setSelected((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
    }
  }

  function submit() {
    const ok = gradeQuiz(payload, selected);
    setCorrect(ok);
    setSubmitted(true);
    onComplete({ correct: ok, selected });
  }

  return (
    <div>
      <p className="mb-3 text-sm" style={{ color: theme.text }}>
        {payload.question_md}
      </p>
      <div className="space-y-2" role="radiogroup" aria-label={payload.question_md}>
        {payload.options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const showResult = submitted;
          const bg = showResult
            ? opt.correct
              ? theme.accent
              : isSelected
                ? '#7f1d1d'
                : theme.surface
            : isSelected
              ? theme.primary
              : theme.surface;
          return (
            <button
              key={opt.id}
              role="radio"
              aria-checked={isSelected}
              disabled={submitted}
              onClick={() => toggle(opt.id)}
              style={{ background: bg, borderColor: theme.border, color: showResult && opt.correct ? theme.bg : theme.text }}
              className="w-full rounded-lg border px-4 py-2 text-left text-sm transition disabled:cursor-default"
            >
              {opt.text_md}
            </button>
          );
        })}
      </div>
      {!submitted ? (
        <button
          onClick={submit}
          disabled={selected.length === 0}
          style={{ background: theme.primary, color: theme.bg }}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Responder
        </button>
      ) : (
        <p className="mt-3 text-sm" style={{ color: theme.muted }}>
          {correct ? payload.feedback.correct_md : payload.feedback.incorrect_md}
        </p>
      )}
    </div>
  );
}
