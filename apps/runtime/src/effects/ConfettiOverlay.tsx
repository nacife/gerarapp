import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from './reduced-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  angle: number;
  velocity: number;
  size: number;
}

const COLORS = ['#f43f5e', '#f59e0b', '#22d3ee', '#8b5cf6', '#10b981', '#f97316'];
const PARTICLE_COUNT = 40;
const DURATION_MS = 2500;

/** Overlay de confete ao concluir capítulo (RF-06.7).
 *  `pointer-events: none` — não bloqueia interação.
 *  Respeita `prefers-reduced-motion`: se true, não renderiza partículas. */
export function ConfettiOverlay({ active }: { active: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active || reduced) {
      setVisible(false);
      return;
    }

    const newParticles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -5 - Math.random() * 10,
      color: COLORS[i % COLORS.length]!,
      angle: -90 + (Math.random() - 0.5) * 60,
      velocity: 1.5 + Math.random() * 2.5,
      size: 6 + Math.random() * 8,
    }));

    setParticles(newParticles);
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [active, reduced]);

  if (!visible || reduced) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[999] overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            '--angle': `${p.angle}deg`,
            '--velocity': p.velocity,
            animationDuration: `${DURATION_MS}ms`,
            opacity: 0.9,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 0.9; }
          80%  { opacity: 0.9; }
          100% { transform: translateY(100vh) rotate(720deg) scale(0.3); opacity: 0; }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}
