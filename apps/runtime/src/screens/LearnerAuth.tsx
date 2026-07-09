import { type FormEvent, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { RuntimeTheme } from '../interactions/theme';

export function LearnerAuth({
  theme,
  appTitle,
  onAuthenticated,
}: {
  theme: RuntimeTheme;
  appTitle: string;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const path = mode === 'signup' ? '/learner/signup' : '/learner/login';
    const body = mode === 'signup' ? { email, name, password } : { email, password };
    const res = await apiFetch(path, { method: 'POST', body });
    setLoading(false);
    if (!res.ok) return setError(res.problem?.detail ?? 'Não foi possível continuar.');
    onAuthenticated();
  }

  return (
    <div style={{ background: theme.bg, color: theme.text }} className="grid min-h-screen place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <p style={{ color: theme.muted }} className="text-xs uppercase tracking-wider">
            {appTitle}
          </p>
          <h1 className="mt-1 text-xl font-bold">
            {mode === 'signup' ? 'Crie sua conta para começar' : 'Bem-vindo(a) de volta'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: theme.muted }}>
            Sua conta guarda seu progresso, XP e certificado neste app.
          </p>
        </div>

        {mode === 'signup' && (
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
            className="w-full rounded-xl border px-4 py-3 outline-none"
          />
        )}
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
          className="w-full rounded-xl border px-4 py-3 outline-none"
        />
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha (mín. 10 caracteres)"
          style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
          className="w-full rounded-xl border px-4 py-3 outline-none"
        />

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          disabled={loading}
          style={{ background: theme.primary, color: theme.bg }}
          className="w-full rounded-xl px-4 py-3 font-semibold transition disabled:opacity-60"
        >
          {loading ? 'Entrando…' : mode === 'signup' ? 'Criar conta e começar' : 'Entrar'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
          style={{ color: theme.muted }}
          className="w-full text-center text-sm underline"
        >
          {mode === 'signup' ? 'Já tenho conta' : 'Criar uma conta'}
        </button>
      </form>
    </div>
  );
}
