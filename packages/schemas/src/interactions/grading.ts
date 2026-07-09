import type { Quiz } from './quiz';
import type { Cloze } from './cloze';
import type { Dragdrop } from './dragdrop';
import type { Timeline } from './timeline';
import type { Hotspot } from './hotspot';
import type { Scenario } from './scenario';
import type { Mindmap } from './mindmap';

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Corrige um quiz: single/true_false exige o conjunto exato de corretas; multiple idem. */
export function gradeQuiz(payload: Quiz, selectedIds: string[]): boolean {
  const correctIds = new Set(payload.options.filter((o) => o.correct).map((o) => o.id));
  const selected = new Set(selectedIds);
  if (correctIds.size !== selected.size) return false;
  for (const id of correctIds) if (!selected.has(id)) return false;
  return true;
}

export interface ClozeGradeResult {
  allCorrect: boolean;
  perGap: Record<string, boolean>;
}

/** Corrige um cloze gap a gap (normalização + case_sensitive por gap). */
export function gradeCloze(payload: Cloze, answers: Record<string, string>): ClozeGradeResult {
  const perGap: Record<string, boolean> = {};
  for (const gap of payload.gaps) {
    const given = answers[gap.id] ?? '';
    const accepted = gap.answers.some((a) =>
      gap.case_sensitive ? a.trim() === given.trim() : normalize(a) === normalize(given),
    );
    perGap[gap.id] = accepted;
  }
  return { allCorrect: Object.values(perGap).every(Boolean), perGap };
}

/** Corrige dragdrop despachando por variante (ordering/matching/categorize). */
export function gradeDragdrop(
  payload: Dragdrop,
  submission: { order?: string[]; mapping?: Record<string, string> },
): boolean {
  if (payload.variant === 'ordering') {
    const order = submission.order ?? [];
    const expected = [...payload.items]
      .sort((a, b) => (a.correct_position ?? 0) - (b.correct_position ?? 0))
      .map((i) => i.id);
    return order.length === expected.length && order.every((id, i) => id === expected[i]);
  }
  const mapping = submission.mapping ?? {};
  const key = payload.variant === 'matching' ? 'match_target_id' : 'category_id';
  return payload.items.every((item) => mapping[item.id] === (item as Record<string, unknown>)[key]);
}

/** Ordem canônica dos eventos de uma timeline (por `order` se houver, senão a ordem autoral). */
export function timelineCanonicalOrder(payload: Timeline): string[] {
  const hasOrder = payload.events.every((e) => typeof e.order === 'number');
  const events = hasOrder
    ? [...payload.events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : payload.events;
  return events.map((e) => e.id);
}

/** Corrige a reconstrução de uma timeline embaralhada (quiz_mode). */
export function gradeTimelineOrder(payload: Timeline, order: string[]): boolean {
  const expected = timelineCanonicalOrder(payload);
  return order.length === expected.length && order.every((id, i) => id === expected[i]);
}

/** Corrige "clique onde fica X": pede um spot e confere o clicado (quiz_mode). */
export function gradeHotspot(askedSpotId: string, clickedSpotId: string): boolean {
  return askedSpotId === clickedSpotId;
}

export interface ScenarioResult {
  valid: boolean;
  reachedOutcome: boolean;
  outcomeScore: number;
  allBest: boolean;
}

/**
 * Valida e avalia um caminho percorrido no cenário: cada passo deve ser uma
 * transição legal do grafo; o resultado inclui o score do outcome final e se
 * todas as escolhas feitas foram "best".
 */
export function gradeScenarioPath(
  payload: Scenario,
  choiceNextIds: string[],
): ScenarioResult {
  const nodes = new Map(payload.nodes.map((n) => [n.id, n]));
  let current = payload.nodes.find((n) => n.id === payload.start_node_id);
  if (!current) return { valid: false, reachedOutcome: false, outcomeScore: 0, allBest: false };

  let allBest = true;
  for (const nextId of choiceNextIds) {
    if (current.kind !== 'situation') return { valid: false, reachedOutcome: false, outcomeScore: 0, allBest: false };
    const choice = current.choices?.find((c) => c.next_node_id === nextId);
    if (!choice) return { valid: false, reachedOutcome: false, outcomeScore: 0, allBest: false };
    if (choice.quality !== 'best') allBest = false;
    const next = nodes.get(nextId);
    if (!next) return { valid: false, reachedOutcome: false, outcomeScore: 0, allBest: false };
    current = next;
  }

  const reachedOutcome = current.kind === 'outcome';
  return {
    valid: true,
    reachedOutcome,
    outcomeScore: reachedOutcome ? (current.outcome_score ?? 0) : 0,
    allBest: reachedOutcome && allBest,
  };
}

/** Fração de nós de um mapa mental já visitados (proxy de engajamento/conclusão). */
export function mindmapCompletionRatio(payload: Mindmap, viewedNodeIds: string[]): number {
  const viewed = new Set(viewedNodeIds);
  const total = payload.nodes.length || 1;
  return payload.nodes.filter((n) => viewed.has(n.id)).length / total;
}
