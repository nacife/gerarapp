import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { apiFetch } from './lib/api';
import { useSystemColorScheme } from './lib/color-scheme';
import type { Manifest } from './lib/manifest';
import { InteractionRunner, type RunnableInteraction } from './interactions/InteractionRunner';
import { FALLBACK_THEME, type CompletionDetail, type RuntimeTheme } from './interactions/theme';
import { LearnerAuth } from './screens/LearnerAuth';
import { CertificateScreen } from './screens/CertificateScreen';
import { SenseiPanel } from './sensei/SenseiPanel';
import { ConfettiOverlay } from './effects/ConfettiOverlay';
import { FocusMode } from './focus/FocusMode';
import { StoryMap } from './story/StoryMap';
import { BattleLobby } from './battle/BattleLobby';

function activeTheme(manifest: Manifest | null, scheme: 'light' | 'dark'): RuntimeTheme {
  const palette = manifest?.theme.palette;
  return (scheme === 'dark' ? palette?.dark : palette?.light) ?? FALLBACK_THEME;
}

interface AnnotatedNode {
  id: string;
  title: string;
  blockId?: string;
  done?: boolean;
  children?: AnnotatedNode[];
}
interface ProgressSnapshot {
  xp: number;
  streakDays: number;
  percent: number;
  chapters: AnnotatedNode[];
  certificate: { verifyCode: string; issuedAt: string } | null;
}

function slugFromPath(): string {
  return decodeURIComponent(window.location.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
}

type Phase = 'loading' | 'auth' | 'password' | 'denied' | 'active' | 'certificate';

export function App() {
  const scheme = useSystemColorScheme();
  const [slug] = useState(slugFromPath);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [passwordKey, setPasswordKey] = useState<string | undefined>(undefined);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [confetti, setConfetti] = useState(false);
  const [verifyCode, setVerifyCode] = useState<string | null>(null);
  const [showTimeCapsule, setShowTimeCapsule] = useState(false);

  const loadProgress = useCallback(async (id: string) => {
    const res = await apiFetch<ProgressSnapshot>(`/public/enrollments/${id}/progress`);
    if (res.ok && res.data) {
      setProgress(res.data);
      if (res.data.certificate) {
        setVerifyCode(res.data.certificate.verifyCode);
        setPhase('certificate');
      }
    }
  }, []);

  const tryEnroll = useCallback(
    async (key?: string) => {
      const res = await apiFetch<{ enrollmentId: string; manifest: Manifest }>(
        `/public/apps/${encodeURIComponent(slug)}/enroll`,
        { method: 'POST', body: { accessKey: key } },
      );
      if (res.ok && res.data) {
        setEnrollmentId(res.data.enrollmentId);
        setManifest(res.data.manifest);
        setPhase('active');
        void loadProgress(res.data.enrollmentId);
        return;
      }
      const slugErr = res.problem?.type?.split('/').pop();
      if (slugErr === 'app-locked') return setPhase('password');
      if (slugErr === 'not-invited') {
        setMessage('Você precisa ser convidado(a) pelo criador para acessar este app.');
        return setPhase('denied');
      }
      setMessage(res.problem?.detail ?? 'Não foi possível acessar este app.');
      setPhase('denied');
    },
    [slug, loadProgress],
  );

  useEffect(() => {
    if (!slug) return;
    void apiFetch('/learner/me').then((res) => {
      if (res.ok) void tryEnroll();
      else setPhase('auth');
    });
  }, [slug, tryEnroll]);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    await tryEnroll(passwordKey);
  }

  async function handleInteractionComplete(interactionId: string, detail: CompletionDetail) {
    if (!enrollmentId) return;
    setCompletedIds((s) => new Set(s).add(interactionId));
    const prevPercent = progress?.percent ?? 0;
    const res = await apiFetch<{
      certificateIssued: boolean;
      verifyCode?: string;
      xpTotal: number;
      streakDays: number;
    }>(`/public/enrollments/${enrollmentId}/events`, {
      method: 'POST',
      body: { event: 'answer', interactionId, detail },
    });
    if (res.ok && res.data?.certificateIssued && res.data.verifyCode) {
      setConfetti(true);
      setVerifyCode(res.data.verifyCode);
      setPhase('certificate');
      return;
    }
    await loadProgress(enrollmentId);
    // Confetti dispara em marcos significativos: conclusão de capítulo (salto de % > 10pp)
    const newPercent = progress?.percent ?? 0;
    if (newPercent > prevPercent && newPercent - prevPercent >= 10) {
      setConfetti(true);
    }
    if (newPercent === 100 && prevPercent < 100) {
      setShowTimeCapsule(true);
    }
  }

  if (!slug) return <Landing />;
  if (slug === 'preview') return <PreviewMode />;
  if (phase === 'loading') return <Centered>Carregando…</Centered>;

  if (phase === 'auth') {
    return (
      <LearnerAuth
        theme={activeTheme(manifest, scheme)}
        appTitle={slug}
        onAuthenticated={() => void tryEnroll(passwordKey)}
      />
    );
  }

  if (phase === 'password') {
    return (
      <Centered>
        <form onSubmit={handlePasswordSubmit} className="w-full max-w-xs space-y-3 text-center">
          <p className="text-lg font-semibold">🔒 App protegido por senha</p>
          <input
            type="password"
            value={passwordKey ?? ''}
            onChange={(e) => setPasswordKey(e.target.value)}
            placeholder="Senha do app"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-center outline-none"
          />
          <button className="w-full rounded-lg bg-cyan-gradient px-4 py-2 font-semibold text-gray-950">
            Entrar
          </button>
        </form>
      </Centered>
    );
  }

  if (phase === 'denied') return <Centered>{message ?? 'Acesso negado.'}</Centered>;

  if (phase === 'certificate' && verifyCode) {
    return <CertificateScreen theme={activeTheme(manifest, scheme)} verifyCode={verifyCode} />;
  }

  if (!manifest || !progress || !enrollmentId) return <Centered>Carregando…</Centered>;
  return (
    <>
      <ConfettiOverlay active={confetti} />
      <LearnerExperience
        slug={slug}
        enrollmentId={enrollmentId}
        manifest={manifest}
        theme={activeTheme(manifest, scheme)}
        progress={progress}
        completedIds={completedIds}
        onComplete={handleInteractionComplete}
      />
      {showTimeCapsule && (
        <TimeCapsuleModal
          enrollmentId={enrollmentId}
          theme={activeTheme(manifest, scheme)}
          onClose={() => setShowTimeCapsule(false)}
        />
      )}
    </>
  );
}

function TimeCapsuleModal({
  enrollmentId,
  theme,
  onClose,
}: {
  enrollmentId: string;
  theme: RuntimeTheme;
  onClose: () => void;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    const res = await apiFetch(`/public/enrollments/${enrollmentId}/time-capsule`, {
      method: 'POST',
      body: { message },
    });
    setSending(false);
    if (res.ok) setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
      <div
        style={{ background: theme.bg, color: theme.text, borderColor: theme.border }}
        className="w-full max-w-sm rounded-2xl border p-6 shadow-xl relative"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-xl opacity-50 hover:opacity-100"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold" style={{ color: theme.primary }}>
          ⏳ Cápsula do Tempo
        </h2>

        {sent ? (
          <div className="mt-4 text-center">
            <p className="mb-4 text-lg">Sua cápsula foi selada! ✉️</p>
            <p className="text-sm opacity-80 mb-6">
              Em breve, um e-mail especial será entregue a você do futuro, lembrando as conquistas
              de hoje.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-lg py-3 font-semibold transition hover:opacity-90"
              style={{ background: theme.primary, color: theme.bg }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm opacity-80">
              Você concluiu 100% desta jornada! Escreva uma mensagem para o seu "eu do futuro"
              celebrar esse momento.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: Não pare de estudar, você está indo super bem! Lembre-se do que aprendeu hoje."
                className="h-32 w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.03] p-3 outline-none"
                required
              />
              <button
                disabled={sending}
                className="w-full rounded-lg py-3 font-semibold transition hover:opacity-90 disabled:opacity-50"
                style={{ background: theme.primary, color: theme.bg }}
              >
                {sending ? 'Selando...' : 'Selar Cápsula'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function LearnerExperience({
  slug,
  enrollmentId,
  manifest,
  theme,
  progress,
  completedIds,
  onComplete,
}: {
  slug: string;
  enrollmentId: string;
  manifest: Manifest;
  theme: RuntimeTheme;
  progress: ProgressSnapshot;
  completedIds: Set<string>;
  onComplete: (interactionId: string, detail: CompletionDetail) => void;
}) {
  const interactionsByBlock = new Map<string, RunnableInteraction[]>();
  for (const it of manifest.interactions) {
    if (!it.contentBlockId) continue;
    const arr = interactionsByBlock.get(it.contentBlockId) ?? [];
    arr.push(it as RunnableInteraction);
    interactionsByBlock.set(it.contentBlockId, arr);
  }

  const [focusModeBlockId, setFocusModeBlockId] = useState<string | null>(null);
  const [storyModeChapterId, setStoryModeChapterId] = useState<string | null>(null);
  const [showBattle, setShowBattle] = useState(false);

  const isStoryMode = (manifest.theme as any).presentationMode === 'story';

  const regions = progress.chapters.map((ch, i) => ({
    id: ch.id,
    name: ch.title,
    description: '',
    emoji: ['🏰', '⚔️', '🔮', '🗺️', '⛰️'][i % 5] || '🏰',
    position: { x: 20 + ((i * 30) % 60), y: 20 + ((i * 20) % 60) },
    done: ch.done,
    current: !ch.done && (i === 0 || !!progress.chapters[i - 1]?.done),
  }));

  const storyMapData = {
    title: 'Aventura de Conhecimento',
    regions,
    startRegionId: regions[0]?.id ?? '',
    finalRegionId: regions[regions.length - 1]?.id ?? '',
  };

  return (
    <div style={{ background: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header
        style={{ background: theme.surface, borderColor: theme.border }}
        className="border-b px-6 py-4"
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{manifest.title}</h1>
            <div
              className="mt-1 h-1.5 w-40 overflow-hidden rounded-full"
              style={{ background: theme.border }}
            >
              <div
                style={{ width: `${progress.percent}%`, background: theme.accent }}
                className="h-full transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => setShowBattle(!showBattle)}
              className="px-2 py-1 rounded text-xs"
              style={{ background: theme.accent, color: theme.bg }}
            >
              ⚔️ Batalha
            </button>
            <span title="streak">🔥 {progress.streakDays}</span>
            <span title="xp">⭐ {progress.xp}</span>
            <span style={{ color: theme.muted }}>{progress.percent}%</span>
          </div>
        </div>
      </header>

      <SenseiPanel slug={slug} enrollmentId={enrollmentId} theme={theme} />

      <main className="mx-auto max-w-2xl space-y-8 px-6 py-8">
        {showBattle ? (
          <div>
            <button
              onClick={() => setShowBattle(false)}
              className="mb-4 text-sm underline"
              style={{ color: theme.primary }}
            >
              ← Voltar para a Lição
            </button>
            <BattleLobby enrollmentId={enrollmentId} theme={theme} />
          </div>
        ) : isStoryMode && !storyModeChapterId ? (
          <StoryMap map={storyMapData} theme={theme} onSelect={setStoryModeChapterId} />
        ) : (
          (isStoryMode
            ? progress.chapters.filter((ch) => ch.id === storyModeChapterId)
            : progress.chapters
          ).map((chapter) => (
            <section key={chapter.id}>
              {isStoryMode && (
                <button
                  onClick={() => setStoryModeChapterId(null)}
                  className="mb-4 text-sm underline"
                  style={{ color: theme.primary }}
                >
                  ← Voltar ao Mapa
                </button>
              )}
              <h2 className="text-xl font-bold" style={{ color: theme.primary }}>
                {chapter.title}
              </h2>
              <div className="mt-3 space-y-4">
                {(chapter.children ?? []).map((section) => (
                  <div key={section.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{section.title}</h3>
                        {section.done && (
                          <span style={{ color: theme.accent }} className="text-xs">
                            ✓ concluído
                          </span>
                        )}
                      </div>
                      {/* Focus Mode Toggle */}
                      {section.blockId && (
                        <button
                          onClick={() =>
                            setFocusModeBlockId(
                              focusModeBlockId === section.blockId
                                ? null
                                : (section.blockId ?? null),
                            )
                          }
                          className="text-xs px-2 py-1 rounded border"
                          style={{
                            borderColor: theme.border,
                            color:
                              focusModeBlockId === section.blockId ? theme.accent : theme.muted,
                          }}
                        >
                          {focusModeBlockId === section.blockId ? 'Sair do Modo Foco' : 'Modo Foco'}
                        </button>
                      )}
                    </div>
                    {focusModeBlockId === section.blockId ? (
                      <FocusMode
                        contentMd={
                          (section as any).excerpt || section.title || 'Conteúdo não disponível.'
                        }
                        theme={theme}
                      />
                    ) : (
                      <div className="space-y-3">
                        {(section.blockId
                          ? interactionsByBlock.get(section.blockId)
                          : undefined
                        )?.map((it) =>
                          completedIds.has(it.id) ? (
                            <div
                              key={it.id}
                              style={{ borderColor: theme.border, color: theme.muted }}
                              className="rounded-xl border border-dashed p-3 text-sm"
                            >
                              ✓ Interação concluída
                            </div>
                          ) : (
                            <InteractionRunner
                              key={it.id}
                              interaction={it}
                              theme={theme}
                              onComplete={(detail) => onComplete(it.id, detail)}
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <footer style={{ color: theme.muted }} className="px-6 py-8 text-center text-xs">
        Feito com EduForge
      </footer>
    </div>
  );
}

function Landing() {
  return (
    <Centered>
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-cyan-gradient font-black text-gray-950">
          E
        </div>
        <h1 className="text-2xl font-bold">Runtime EduForge</h1>
        <p className="mt-2 text-gray-400">
          Os apps publicados são servidos em <code>/:slug</code>. Publique um app no painel do
          criador para vê-lo aqui.
        </p>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center text-gray-300">
      {children}
    </div>
  );
}

function PreviewMode() {
  const [theme, setTheme] = useState<RuntimeTheme>(FALLBACK_THEME);
  const [template, setTemplate] = useState<any>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'UPDATE_THEME') {
        setTheme(e.data.theme);
        setTemplate(e.data.templateConfig);
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  // Simulação de estilos do template
  const radius =
    template?.tokens?.radius === 'none'
      ? '0'
      : template?.tokens?.radius === 'sm'
        ? '0.25rem'
        : template?.tokens?.radius === 'lg'
          ? '1rem'
          : template?.tokens?.radius === 'xl'
            ? '1.5rem'
            : '0.5rem';
  const shadow =
    template?.tokens?.surface === 'soft-shadow' ? '0 4px 20px rgba(0,0,0,0.1)' : 'none';
  const border =
    template?.tokens?.surface === 'bordered'
      ? `2px solid ${theme.border}`
      : `1px solid ${theme.border}`;
  const fontFamily = template?.tokens?.typography?.body || 'inherit';
  const headingFont = template?.tokens?.typography?.heading || 'inherit';

  return (
    <div
      style={{
        background: theme.bg,
        color: theme.text,
        minHeight: '100vh',
        padding: '2rem',
        fontFamily,
      }}
    >
      <div
        className="mx-auto max-w-sm"
        style={{
          borderRadius: radius,
          background: theme.surface,
          boxShadow: shadow,
          border,
          padding: '1.25rem',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center font-black"
            style={{
              background: theme.primary,
              color: theme.bg,
              borderRadius: radius === '0' ? '0' : '0.25rem',
            }}
          >
            E
          </span>
          <strong style={{ fontFamily: headingFont }}>Biologia Viva</strong>
        </div>
        <h3
          className="mt-4 text-xl font-bold"
          style={{ color: theme.primary, fontFamily: headingFont }}
        >
          A Célula
        </h3>
        <p className="mt-1 text-sm" style={{ color: theme.muted }}>
          A membrana plasmática é uma bicamada lipídica que separa o interior da célula do ambiente
          externo.
        </p>
        <button
          className="mt-4 w-full py-2 font-semibold transition hover:opacity-90"
          style={{
            background: theme.primary,
            color: theme.bg,
            borderRadius: radius,
            border: template?.tokens?.surface === 'bordered' ? `2px solid ${theme.text}` : 'none',
          }}
        >
          Começar Quiz
        </button>
      </div>

      <div className="mx-auto mt-6 max-w-sm space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3"
            style={{ background: theme.bg, borderRadius: radius, border, boxShadow: shadow }}
          >
            <span style={{ fontFamily: headingFont, fontWeight: 500 }}>Tópico {i}</span>
            <span style={{ color: theme.muted, fontSize: '0.8rem' }}>pendente</span>
          </div>
        ))}
      </div>
    </div>
  );
}
