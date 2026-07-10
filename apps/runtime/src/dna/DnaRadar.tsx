import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { RuntimeTheme } from '../interactions/theme';

interface DnaProfile {
  learnerId: string;
  topics: { topic: string; retention: number; events: number }[];
  bestHour: number;
  bestInteractionTypes: { type: string; accuracy: number; count: number }[];
  pace: number;
  activeDays: number;
  xp: number;
  completionPercent: number;
}

const TYPE_LABELS: Record<string, string> = {
  quiz: 'Quiz', flashcard_deck: 'Flashcards', cloze: 'Lacunas',
  dragdrop: 'Drag & Drop', hotspot: 'Hotspot', timeline: 'Linha do Tempo',
  scenario: 'Cenário', audio: 'Áudio', mindmap: 'Mapa Mental',
};

export function DnaRadar({ enrollmentId, theme }: { enrollmentId: string; theme: RuntimeTheme }) {
  const [profile, setProfile] = useState<DnaProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DnaProfile>(`/public/enrollments/${enrollmentId}/dna`).then(res => {
      if (res.ok && res.data) setProfile(res.data);
      setLoading(false);
    });
  }, [enrollmentId]);

  if (loading) return <p className="text-xs" style={{ color: theme.muted }}>Analisando seu DNA de aprendizagem…</p>;
  if (!profile) return null;

  const radarSize = 200;
  const cx = radarSize / 2, cy = radarSize / 2, r = 80;

  const tps = profile.topics.slice(0, 8);
  const angleStep = (2 * Math.PI) / (tps.length || 1);

  return (
    <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: theme.border, background: theme.surface }}>
      <h3 className="text-sm font-bold" style={{ color: theme.text }}>🧬 Seu DNA de Aprendizagem</h3>

      {/* Radar de tópicos */}
      <div className="flex justify-center">
        <svg width={radarSize} height={radarSize}>
          {/* Grid rings */}
          {[0.25, 0.5, 0.75, 1].map(s => (
            <circle key={s} cx={cx} cy={cy} r={r * s} fill="none" stroke={theme.border} strokeWidth="0.5" opacity="0.5" />
          ))}
          {/* Axes + data polygon */}
          <polygon
            points={tps.map((t, i) => {
              const a = angleStep * i - Math.PI / 2;
              return `${cx + r * t.retention * Math.cos(a)},${cy + r * t.retention * Math.sin(a)}`;
            }).join(' ')}
            fill={theme.accent} fillOpacity="0.2" stroke={theme.accent} strokeWidth="1.5"
          />
          {/* Labels */}
          {tps.map((t, i) => {
            const a = angleStep * i - Math.PI / 2;
            const lx = cx + (r + 22) * Math.cos(a);
            const ly = cy + (r + 22) * Math.sin(a);
            return <text key={t.topic} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={theme.muted}>{t.topic.slice(0, 8)}</text>;
          })}
        </svg>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span style={{ color: theme.muted }}>Melhor horário:</span> <span style={{ color: theme.text }}>{profile.bestHour}h</span></div>
        <div><span style={{ color: theme.muted }}>Dias ativos:</span> <span style={{ color: theme.text }}>{profile.activeDays}</span></div>
        <div><span style={{ color: theme.muted }}>Ritmo:</span> <span style={{ color: theme.text }}>{profile.pace}/dia</span></div>
        <div><span style={{ color: theme.muted }}>Conclusão:</span> <span style={{ color: theme.text }}>{profile.completionPercent}%</span></div>
      </div>

      {/* Tipos preferidos */}
      <div>
        <p className="text-xs mb-1" style={{ color: theme.muted }}>Seus melhores formatos:</p>
        <div className="flex flex-wrap gap-1">
          {profile.bestInteractionTypes.slice(0, 3).map(t => (
            <span key={t.type} className="rounded-full px-2 py-0.5 text-xs" style={{ background: theme.accent, color: theme.bg }}>
              {TYPE_LABELS[t.type] ?? t.type} {(t.accuracy * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
