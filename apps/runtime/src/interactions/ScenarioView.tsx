import { useState } from 'react';
import { gradeScenarioPath, type Scenario } from '@eduforge/schemas';
import type { CompletionDetail, RuntimeTheme } from './theme';

export function ScenarioView({
  payload,
  theme,
  onComplete,
}: {
  payload: Scenario;
  theme: RuntimeTheme;
  onComplete: (detail: CompletionDetail) => void;
}) {
  const [currentId, setCurrentId] = useState(payload.start_node_id);
  const [path, setPath] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const node = payload.nodes.find((n) => n.id === currentId)!;

  function choose(nextId: string) {
    const nextPath = [...path, nextId];
    setPath(nextPath);
    setCurrentId(nextId);
    const next = payload.nodes.find((n) => n.id === nextId);
    if (next?.kind === 'outcome') {
      const result = gradeScenarioPath(payload, nextPath);
      setFinished(true);
      onComplete({ correct: result.reachedOutcome, outcomeScore: result.outcomeScore, allBest: result.allBest });
    }
  }

  return (
    <div>
      <h4 className="mb-2 font-semibold" style={{ color: theme.text }}>
        {payload.title_md}
      </h4>
      <p className="mb-3 text-sm" style={{ color: theme.text }}>
        {node.text_md}
      </p>
      {!finished && node.choices && (
        <div className="space-y-2">
          {node.choices.map((c, i) => (
            <button
              key={i}
              onClick={() => choose(c.next_node_id)}
              style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
              className="w-full rounded-lg border px-4 py-2 text-left text-sm transition hover:brightness-110"
            >
              {c.label_md}
            </button>
          ))}
        </div>
      )}
      {finished && (
        <p className="text-sm font-medium" style={{ color: theme.accent }}>
          Fim do cenário — pontuação: {node.outcome_score ?? 0}
        </p>
      )}
    </div>
  );
}
