import type {
  Audio,
  Cloze,
  Dragdrop,
  FlashcardDeck,
  Hotspot,
  Mindmap,
  Quiz,
  Scenario,
  Timeline,
} from '@eduforge/schemas';
import { AudioView } from './AudioView';
import { ClozeView } from './ClozeView';
import { DragDropView } from './DragDropView';
import { FlashcardsView } from './FlashcardsView';
import { HotspotView } from './HotspotView';
import { MindmapView } from './MindmapView';
import { QuizView } from './QuizView';
import { ScenarioView } from './ScenarioView';
import type { CompletionDetail, RuntimeTheme } from './theme';
import { TimelineView } from './TimelineView';

export const INTERACTION_TYPE_LABEL: Record<string, string> = {
  quiz: 'Quiz',
  flashcard_deck: 'Flashcards',
  cloze: 'Complete a lacuna',
  dragdrop: 'Arrastar e soltar',
  timeline: 'Linha do tempo',
  hotspot: 'Hotspots',
  scenario: 'Cenário',
  audio: 'Áudio',
  mindmap: 'Mapa mental',
};

export interface RunnableInteraction {
  id: string;
  type: string;
  payload: unknown;
  difficulty: string;
}

export function InteractionRunner({
  interaction,
  theme,
  onComplete,
}: {
  interaction: RunnableInteraction;
  theme: RuntimeTheme;
  onComplete: (detail: CompletionDetail) => void;
}) {
  const payload = interaction.payload as { objective?: string; xp?: number };

  return (
    <div style={{ background: theme.surface, borderColor: theme.border }} className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          style={{ background: theme.accent, color: theme.bg }}
          className="rounded-full px-2 py-0.5 text-xs font-medium"
        >
          {INTERACTION_TYPE_LABEL[interaction.type] ?? interaction.type}
        </span>
        <span className="text-xs" style={{ color: theme.muted }}>
          +{payload.xp ?? 10} XP
        </span>
      </div>
      {payload.objective && (
        <p className="mb-2 text-xs italic" style={{ color: theme.muted }}>
          {payload.objective}
        </p>
      )}
      {renderBody(interaction, theme, onComplete)}
    </div>
  );
}

function renderBody(
  interaction: RunnableInteraction,
  theme: RuntimeTheme,
  onComplete: (detail: CompletionDetail) => void,
) {
  switch (interaction.type) {
    case 'quiz':
      return <QuizView payload={interaction.payload as Quiz} theme={theme} onComplete={onComplete} />;
    case 'flashcard_deck':
      return <FlashcardsView payload={interaction.payload as FlashcardDeck} theme={theme} onComplete={onComplete} />;
    case 'cloze':
      return <ClozeView payload={interaction.payload as Cloze} theme={theme} onComplete={onComplete} />;
    case 'dragdrop':
      return <DragDropView payload={interaction.payload as Dragdrop} theme={theme} onComplete={onComplete} />;
    case 'timeline':
      return <TimelineView payload={interaction.payload as Timeline} theme={theme} onComplete={onComplete} />;
    case 'hotspot':
      return <HotspotView payload={interaction.payload as Hotspot} theme={theme} onComplete={onComplete} />;
    case 'scenario':
      return <ScenarioView payload={interaction.payload as Scenario} theme={theme} onComplete={onComplete} />;
    case 'audio':
      return <AudioView payload={interaction.payload as Audio} theme={theme} onComplete={onComplete} />;
    case 'mindmap':
      return <MindmapView payload={interaction.payload as Mindmap} theme={theme} onComplete={onComplete} />;
    default:
      return (
        <p style={{ color: theme.muted }} className="text-sm">
          Tipo não suportado: {interaction.type}
        </p>
      );
  }
}
