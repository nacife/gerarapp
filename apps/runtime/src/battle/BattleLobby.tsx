import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { RuntimeTheme } from '../interactions/theme';

interface Player {
  id: string;
  name: string;
  score: number;
}
interface BattleEvent {
  type: 'join' | 'start' | 'score' | 'end';
  data: any;
}

export function BattleLobby({
  enrollmentId,
  theme,
}: {
  enrollmentId: string;
  theme: RuntimeTheme;
}) {
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'playing' | 'finished'>('idle');
  const [currentQuestion, setCurrentQuestion] = useState<{
    question: string;
    options: string[];
    index: number;
    total: number;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (status === 'idle') return;

    // Conectar ao SSE
    const source = new EventSource(`/v1/public/enrollments/${enrollmentId}/battle/stream`);
    source.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as BattleEvent;
      if (parsed.type === 'join' || parsed.type === 'score') {
        setPlayers(parsed.data.players || []);
      } else if (parsed.type === 'start') {
        setStatus('playing');
        setCurrentQuestion({
          question: 'O que é fotossíntese?',
          options: [
            'Processo de conversão de luz em energia',
            'Divisão celular',
            'Respiração celular',
            'Síntese de proteínas',
          ],
          index: 0,
          total: 10,
        });
        setTimeLeft(15);
      }
    };

    return () => source.close();
  }, [status, enrollmentId]);

  async function joinRoom() {
    setStatus('waiting');
    setMsg('Conectando à sala...');
    await apiFetch(`/public/enrollments/${enrollmentId}/battle/join`, {
      method: 'POST',
      body: { name: playerName || 'Jogador' },
    });
    setMsg('Aguardando outros jogadores...');
  }

  async function handleAnswer(isCorrect: boolean) {
    if (isCorrect) {
      setMsg('✅ Correto! +100 XP');
      await apiFetch(`/public/enrollments/${enrollmentId}/battle/score`, {
        method: 'POST',
        body: { delta: 100 },
      });
    } else {
      setMsg('❌ Incorreto');
    }
  }

  useEffect(() => {
    if (status !== 'playing' || !currentQuestion) return;
    const timer = setInterval(
      () =>
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timer);
            return 0;
          }
          return t - 1;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [status, currentQuestion]);

  return (
    <div
      className="space-y-4 rounded-xl border p-4"
      style={{ borderColor: theme.border, background: theme.surface }}
    >
      <h3 className="text-sm font-bold" style={{ color: theme.text }}>
        ⚔️ Batalha de Quiz
      </h3>

      {status === 'idle' && (
        <div className="space-y-2">
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Seu nome"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: theme.border, background: theme.bg, color: theme.text }}
          />
          <button
            onClick={joinRoom}
            className="w-full rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: theme.accent, color: theme.bg }}
          >
            Entrar na Batalha
          </button>
        </div>
      )}

      {status === 'waiting' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: theme.muted }}>
            {msg}
          </p>
          <div className="space-y-2">
            <h4 className="text-xs font-semibold" style={{ color: theme.text }}>
              Jogadores:
            </h4>
            {players.map((p) => (
              <div
                key={p.id}
                className="text-sm flex justify-between p-2 rounded"
                style={{ background: theme.bg, color: theme.text }}
              >
                <span>{p.name}</span>
                <span className="font-mono">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'playing' && currentQuestion && (
        <div className="space-y-3">
          <div className="flex justify-between text-xs" style={{ color: theme.muted }}>
            <span>
              Questão {currentQuestion.index + 1}/{currentQuestion.total}
            </span>
            <span className={timeLeft <= 5 ? 'text-red-400' : ''}>{timeLeft}s</span>
          </div>
          <div className="h-1 rounded-full" style={{ background: theme.border }}>
            <div
              className="h-1 rounded-full transition-all"
              style={{
                width: `${(timeLeft / 15) * 100}%`,
                background: timeLeft <= 5 ? '#f87171' : theme.accent,
              }}
            />
          </div>
          <p className="text-sm font-medium" style={{ color: theme.text }}>
            {currentQuestion.question}
          </p>
          <div className="space-y-1">
            {currentQuestion.options.map((o, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i === 0)}
                className="w-full rounded-lg border px-3 py-2 text-sm text-left"
                style={{ borderColor: theme.border, color: theme.text }}
              >
                {o}
              </button>
            ))}
          </div>
          {msg && (
            <p
              className="text-xs font-bold text-center"
              style={{ color: msg.includes('✅') ? '#4ade80' : '#f87171' }}
            >
              {msg}
            </p>
          )}

          <div className="mt-4 pt-4 border-t" style={{ borderColor: theme.border }}>
            <h4 className="text-xs font-semibold mb-2" style={{ color: theme.text }}>
              Placar:
            </h4>
            {players.map((p) => (
              <div
                key={p.id}
                className="text-sm flex justify-between"
                style={{ color: theme.text }}
              >
                <span>{p.name}</span>
                <span className="font-mono">{p.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
