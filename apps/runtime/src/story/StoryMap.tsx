import type { RuntimeTheme } from '../interactions/theme';

interface StoryRegion { id: string; name: string; description: string; emoji: string; position: { x: number; y: number }; done?: boolean; current?: boolean }
interface StoryMapData { title: string; regions: StoryRegion[]; startRegionId: string; finalRegionId: string }

export function StoryMap({ map, theme, onSelect }: { map: StoryMapData; theme: RuntimeTheme; onSelect: (id: string) => void }) {
  return (
    <div className="relative rounded-xl border p-4" style={{ borderColor: theme.border, background: theme.surface }}>
      <h3 className="text-sm font-bold mb-4" style={{ color: theme.text }}>🗺️ {map.title}</h3>
      <div className="relative" style={{ height: 300 }}>
        {/* Linhas de conexão */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {map.regions.filter(r => map.regions.some(r2 => r2.id !== r.id)).map((r, i) => {
            const next = map.regions[i + 1];
            if (!next) return null;
            return <line key={r.id} x1={`${r.position.x + 3}%`} y1={`${r.position.y + 3}%`} x2={`${next.position.x + 3}%`} y2={`${next.position.y + 3}%`} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />;
          })}
        </svg>
        {/* Regiões */}
        {map.regions.map(r => (
          <button key={r.id} onClick={() => onSelect(r.id)}
            className="absolute flex flex-col items-center gap-1 transition hover:scale-110"
            style={{ left: `${r.position.x}%`, top: `${r.position.y}%`, transform: 'translate(-50%, -50%)' }}>
            <span className={`text-2xl ${r.done ? 'opacity-100' : r.current ? 'opacity-100' : 'opacity-40'}`}>{r.emoji}</span>
            <span className={`text-xs font-medium ${r.current ? 'font-bold' : ''}`} style={{ color: r.current ? theme.accent : r.done ? theme.text : theme.muted }}>{r.name.slice(0, 12)}</span>
            {r.done && <span style={{ color: theme.accent }} className="text-xs">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
