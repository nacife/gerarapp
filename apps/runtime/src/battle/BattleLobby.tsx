import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { RuntimeTheme } from '../interactions/theme';

interface Player { name: string; score: number }

export function BattleLobby({ enrollmentId, theme }: { enrollmentId: string; theme: RuntimeTheme }) {
  const [code, setCode] = useState('');
  const [playerName, setPlayerName] = useState('Anônimo');
  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState<'idle' | 'joined' | 'playing' | 'finished'>('idle');
  const [currentQuestion, setCurrentQuestion] = useState<{ question: string; options: string[]; index: number; total: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [msg, setMsg] = useState('');

  function joinRoom() {
    if (!code) return;
    setStatus('joined');
    setPlayers([{ name: playerName, score: 0 }]);
    setMsg(`Sala ${code}: aguardando jogadores...`);
  }

  function startGame() {
    setStatus('playing');
    setCurrentQuestion({ question: 'O que é fotossíntese?', options: ['Processo de conversão de luz em energia', 'Divisão celular', 'Respiração celular', 'Síntese de proteínas'], index: 0, total: 10 });
    setTimeLeft(15);
  }

  useEffect(() => {
    if (status !== 'playing' || !currentQuestion) return;
    const timer = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(timer); return 0; } return t - 1; }), 1000);
    return () => clearInterval(timer);
  }, [status, currentQuestion]);

  return (
    <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: theme.border, background: theme.surface }}>
      <h3 className="text-sm font-bold" style={{ color: theme.text }}>⚔️ Batalha de Quiz</h3>

      {status === 'idle' && (
        <div className="space-y-2">
          <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Seu nome" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: theme.border, background: theme.bg, color: theme.text }} />
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="Código da sala" className="w-full rounded-lg border px-3 py-2 text-sm font-mono" style={{ borderColor: theme.border, background: theme.bg, color: theme.text }} />
          <button onClick={joinRoom} className="w-full rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: theme.accent, color: theme.bg }}>Entrar na sala</button>
        </div>
      )}

      {status === 'joined' && (
        <div className="space-y-2">
          <p className="text-sm" style={{ color: theme.muted }}>{msg}</p>
          <div className="space-y-1">{players.map(p => <div key={p.name} className="text-sm" style={{ color: theme.text }}>{p.name}</div>)}</div>
          <button onClick={startGame} className="w-full rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: theme.accent, color: theme.bg }}>Iniciar partida</button>
        </div>
      )}

      {status === 'playing' && currentQuestion && (
        <div className="space-y-3">
          <div className="flex justify-between text-xs" style={{ color: theme.muted }}><span>Questão {currentQuestion.index + 1}/{currentQuestion.total}</span><span className={timeLeft <= 5 ? 'text-red-400' : ''}>{timeLeft}s</span></div>
          <div className="h-1 rounded-full" style={{ background: theme.border }}><div className="h-1 rounded-full transition-all" style={{ width: `${(timeLeft / 15) * 100}%`, background: timeLeft <= 5 ? '#f87171' : theme.accent }} /></div>
          <p className="text-sm font-medium" style={{ color: theme.text }}>{currentQuestion.question}</p>
          <div className="space-y-1">{currentQuestion.options.map((o, i) => <button key={i} onClick={() => { if (i === 0) setMsg('✅ Correto! +100 XP'); else setMsg('❌ Incorreto'); }} className="w-full rounded-lg border px-3 py-2 text-sm text-left" style={{ borderColor: theme.border, color: theme.text }}>{o}</button>)}</div>
          {msg && <p className="text-xs font-bold text-center" style={{ color: msg.includes('✅') ? '#4ade80' : '#f87171' }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
