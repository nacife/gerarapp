import { useMemo, useState } from 'react';
import { mindmapCompletionRatio, type Mindmap } from '@eduforge/schemas';
import type { CompletionDetail, RuntimeTheme } from './theme';

const COMPLETION_THRESHOLD = 0.8;

function radialLayout(nodeIds: string[], rootId: string, width: number, height: number) {
  const others = nodeIds.filter((id) => id !== rootId);
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - 40;
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(rootId, { x: cx, y: cy });
  others.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
    positions.set(id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  });
  return positions;
}

export function MindmapView({
  payload,
  theme,
  onComplete,
}: {
  payload: Mindmap;
  theme: RuntimeTheme;
  onComplete: (detail: CompletionDetail) => void;
}) {
  const width = 480;
  const height = 300;
  const positions = useMemo(
    () => radialLayout(payload.nodes.map((n) => n.id), payload.root_id, width, height),
    [payload],
  );
  const [active, setActive] = useState<string | null>(payload.root_id);
  const [viewed, setViewed] = useState<Set<string>>(new Set([payload.root_id]));
  const [notified, setNotified] = useState(false);

  function click(id: string) {
    setActive(id);
    const next = new Set(viewed).add(id);
    setViewed(next);
    const ratio = mindmapCompletionRatio(payload, [...next]);
    if (ratio >= COMPLETION_THRESHOLD && !notified) {
      setNotified(true);
      onComplete({ correct: true, viewedRatio: ratio });
    }
  }

  const activeNode = payload.nodes.find((n) => n.id === active);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 260 }}>
        {payload.edges.map((e, i) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          if (!a || !b) return null;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.border} strokeWidth={1.5} />;
        })}
        {payload.nodes.map((n) => {
          const p = positions.get(n.id)!;
          const isRoot = n.id === payload.root_id;
          const isViewed = viewed.has(n.id);
          return (
            <g key={n.id} onClick={() => click(n.id)} className="cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r={isRoot ? 34 : 26}
                fill={isViewed ? theme.accent : theme.surface}
                stroke={theme.primary}
                strokeWidth={2}
              />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fill={isViewed ? theme.bg : theme.text}
              >
                {n.label_md.slice(0, 12)}
              </text>
            </g>
          );
        })}
      </svg>
      {activeNode?.detail_md && (
        <p className="mt-2 text-sm" style={{ color: theme.muted }}>
          {activeNode.detail_md}
        </p>
      )}
      <p className="mt-1 text-xs" style={{ color: theme.muted }}>
        {viewed.size}/{payload.nodes.length} nós explorados
      </p>
    </div>
  );
}
