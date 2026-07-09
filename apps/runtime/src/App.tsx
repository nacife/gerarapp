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
import { PodcastPlayer } from './media/PodcastPlayer';

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
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [verifyCode, setVerifyCode] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    const res = await apiFetch<any[]>(`/public/apps/${encodeURIComponent(slug)}/media`);
    if (res.ok && res.data) setMediaItems(res.data);
  }, [slug]);

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
        void loadMedia();
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
    const prevDone = completedIds.size;
    setCompletedIds((s) => new Set(s).add(interactionId));
    // Dispara confete quando um capítulo é concluído (RF-06.7).
    if (prevDone === 0 || Math.random() < 0.3) setConfetti(true);
    const res = await apiFetch<{ certificateIssued: boolean; verifyCode?: string; xpTotal: number; streakDays: number }>(
      `/public/enrollments/${enrollmentId}/events`,
      { method: 'POST', body: { event: 'answer', interactionId, detail } },
    );
    if (res.ok && res.data?.certificateIssued && res.data.verifyCode) {
      setVerifyCode(res.data.verifyCode);
      setPhase('certificate');
      return;
    }
    await loadProgress(enrollmentId);
  }

  if (!slug) return <Landing />;
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
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-center outline-none"
          />
          <button className="w-full rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950">Entrar</button>
        </form>
      </Centered>
    );
  }

  if (phase === 'denied') return <Centered>{message ?? 'Acesso negado.'}</Centered>;

  if (phase === 'certificate' && verifyCode) {
    return <CertificateScreen theme={activeTheme(manifest, scheme)} verifyCode={verifyCode} />;
  }

  if (!manifest || !progress) return <Centered>Carregando…</Centered>;
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
      mediaItems={mediaItems}
      onComplete={handleInteractionComplete}
    />
    </>
  );
}

function LearnerExperience({
  slug,
  enrollmentId,
  manifest,
  theme,
  progress,
  completedIds,
  mediaItems,
  onComplete,
}: {
  slug: string;
  enrollmentId: string | null;
  manifest: Manifest;
  theme: RuntimeTheme;
  progress: ProgressSnapshot;
  completedIds: Set<string>;
  mediaItems: any[];
  onComplete: (interactionId: string, detail: CompletionDetail) => void;
}) {
  const interactionsByBlock = new Map<string, RunnableInteraction[]>();
  for (const it of manifest.interactions) {
    if (!it.contentBlockId) continue;
    const arr = interactionsByBlock.get(it.contentBlockId) ?? [];
    arr.push(it as RunnableInteraction);
    interactionsByBlock.set(it.contentBlockId, arr);
  }

  return (
    <div style={{ background: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ background: theme.surface, borderColor: theme.border }} className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{manifest.title}</h1>
            <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full" style={{ background: theme.border }}>
              <div style={{ width: `${progress.percent}%`, background: theme.accent }} className="h-full transition-all" />
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span title="streak">🔥 {progress.streakDays}</span>
            <span title="xp">⭐ {progress.xp}</span>
            <span style={{ color: theme.muted }}>{progress.percent}%</span>
          </div>
        </div>
      </header>

      <SenseiPanel slug={slug} enrollmentId={enrollmentId} theme={theme} />

      <main className="mx-auto max-w-2xl space-y-8 px-6 py-8">
        {progress.chapters.map((chapter) => {
          // Mídia associada a este capítulo (podcasts + ilustrações).
          const chapterMedia = mediaItems.filter((m: any) => {
            const meta = m.meta as Record<string, unknown> | null;
            return meta?.chapterId === chapter.id;
          });
          const podcast = chapterMedia.find((m: any) => m.kind === 'tts');
          const illustration = chapterMedia.find((m: any) => m.kind === 'ai_generated');

          return (
          <section key={chapter.id}>
            <h2 className="text-xl font-bold" style={{ color: theme.primary }}>
              {chapter.title}
            </h2>

            {/* Ilustração IA do capítulo */}
            {illustration && (
              <div className="mt-3">
                <img
                  src={illustration.url}
                  alt={(illustration.meta as any)?.alt ?? 'Ilustração do capítulo'}
                  className="max-h-48 w-full rounded-xl border object-cover"
                  style={{ borderColor: theme.border }}
                />
              </div>
            )}

            {/* Player de podcast */}
            {podcast && (
              <div className="mt-3">
                <PodcastPlayer url={podcast.url} meta={podcast.meta as any} theme={theme} />
              </div>
            )}

            <div className="mt-3 space-y-4">
              {(chapter.children ?? []).map((section) => (
                <div key={section.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-semibold">{section.title}</h3>
                    {section.done && (
                      <span style={{ color: theme.accent }} className="text-xs">
                        ✓ concluído
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {(section.blockId ? interactionsByBlock.get(section.blockId) : undefined)?.map((it) =>
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
                </div>
              ))}
            </div>
          </section>
          );
          })}
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
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-fuchsia-500 font-black text-slate-950">
          E
        </div>
        <h1 className="text-2xl font-bold">Runtime EduForge</h1>
        <p className="mt-2 text-slate-400">
          Os apps publicados são servidos em <code>/:slug</code>. Publique um app no painel do
          criador para vê-lo aqui.
        </p>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center px-6 text-center text-slate-300">{children}</div>;
}
