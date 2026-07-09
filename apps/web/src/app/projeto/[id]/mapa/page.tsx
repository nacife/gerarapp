'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api';

const LOW_CONFIDENCE = 0.7;

interface MapNode {
  id: string;
  title: string;
  confidence: number;
  kind?: string;
  excerpt?: string;
  blockId?: string;
  children?: MapNode[];
}
interface ContentMap {
  id: string;
  revision: number;
  tree: { chapters: MapNode[] };
  structureConfidence: number | null;
  approvedAt: string | null;
}

function renameNode(chapters: MapNode[], id: string, title: string): MapNode[] {
  return chapters.map((ch) => {
    if (ch.id === id) return { ...ch, title };
    if (ch.children) return { ...ch, children: renameNode(ch.children, id, title) };
    return ch;
  });
}

/** Move uma seção para o fim de outro capítulo (drag-and-drop, US-ING-02). */
function moveSection(chapters: MapNode[], sectionId: string, targetChapterId: string): MapNode[] {
  let moved: MapNode | undefined;
  const without = chapters.map((ch) => {
    const children = ch.children ?? [];
    const found = children.find((s) => s.id === sectionId);
    if (found) moved = found;
    return { ...ch, children: children.filter((s) => s.id !== sectionId) };
  });
  if (!moved) return chapters;
  return without.map((ch) =>
    ch.id === targetChapterId ? { ...ch, children: [...(ch.children ?? []), moved!] } : ch,
  );
}

function confidenceBadge(confidence: number) {
  const pct = Math.round(confidence * 100);
  const low = confidence < LOW_CONFIDENCE;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs ${
        low ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
      }`}
    >
      {low ? '⚠ ' : '✓'}
      {pct}%
    </span>
  );
}

export default function ContentMapPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const [map, setMap] = useState<ContentMap | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [dragChapter, setDragChapter] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiFetch<ContentMap>(`/projects/${projectId}/content-map`).then((res) => {
      if (res.status === 401) return router.replace('/entrar');
      if (!res.ok || !res.data) return setNotFound(true);
      setMap(res.data);
    });
  }, [projectId, router]);

  function updateTree(chapters: MapNode[]) {
    setMap((m) => (m ? { ...m, tree: { chapters } } : m));
    setDirty(true);
  }

  async function save() {
    if (!map) return;
    setSaving(true);
    const res = await apiFetch<ContentMap>(`/projects/${projectId}/content-map`, {
      method: 'PUT',
      body: { tree: map.tree },
    });
    setSaving(false);
    if (res.ok && res.data) {
      setMap(res.data);
      setDirty(false);
    }
  }

  async function approve() {
    if (dirty) await save();
    const res = await apiFetch<{ approvedAt: string }>(
      `/projects/${projectId}/content-map/approve`,
      { method: 'POST' },
    );
    if (res.ok && res.data) {
      setMap((m) => (m ? { ...m, approvedAt: res.data!.approvedAt } : m));
    }
  }

  if (notFound) {
    return (
      <main className="grid min-h-screen place-items-center text-slate-400">
        Mapa de Conteúdo ainda não gerado.
      </main>
    );
  }
  if (!map) {
    return <main className="grid min-h-screen place-items-center text-slate-400">Carregando…</main>;
  }

  const approved = map.approvedAt !== null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            ①Upload — <span className="text-sky-400">②Mapa</span> — ③Visual — ④Interações — ⑤Revisão
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Mapa de Conteúdo</h1>
          <p className="text-sm text-slate-500">
            revisão {map.revision} · confiança média{' '}
            {map.structureConfidence != null ? `${Math.round(map.structureConfidence * 100)}%` : '—'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 disabled:opacity-40"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            onClick={approve}
            className="rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
          >
            {approved ? '✓ Aprovado' : 'Aprovar mapa →'}
          </button>
        </div>
      </header>

      <p className="text-xs text-slate-500">
        Arraste uma seção para outro capítulo. Clique num título para renomear. Blocos com baixa
        confiança aparecem em <span className="text-amber-300">âmbar</span>.
      </p>

      <div className="space-y-4">
        {map.tree.chapters.map((chapter) => (
          <div
            key={chapter.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragChapter(chapter.id);
            }}
            onDragLeave={() => setDragChapter((c) => (c === chapter.id ? null : c))}
            onDrop={() => {
              const sid = (window as unknown as { __efDrag?: string }).__efDrag;
              if (sid) updateTree(moveSection(map.tree.chapters, sid, chapter.id));
              setDragChapter(null);
            }}
            className={`rounded-2xl border p-4 transition ${
              dragChapter === chapter.id
                ? 'border-sky-500 bg-sky-500/5'
                : 'border-slate-800 bg-slate-900/40'
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="text-slate-500">▾</span>
              <EditableTitle
                node={chapter}
                editing={editing === chapter.id}
                onEdit={() => setEditing(chapter.id)}
                onSave={(t) => {
                  updateTree(renameNode(map.tree.chapters, chapter.id, t));
                  setEditing(null);
                }}
                className="font-semibold"
              />
              {confidenceBadge(chapter.confidence)}
            </div>

            <div className="space-y-1.5 pl-6">
              {(chapter.children ?? []).map((section) => {
                const low = section.confidence < LOW_CONFIDENCE;
                return (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => {
                      (window as unknown as { __efDrag?: string }).__efDrag = section.id;
                    }}
                    className={`flex cursor-grab items-center gap-2 rounded-lg border px-3 py-2 text-sm active:cursor-grabbing ${
                      low ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <span className="text-slate-600">⠿</span>
                    <EditableTitle
                      node={section}
                      editing={editing === section.id}
                      onEdit={() => setEditing(section.id)}
                      onSave={(t) => {
                        updateTree(renameNode(map.tree.chapters, section.id, t));
                        setEditing(null);
                      }}
                      className="flex-1"
                    />
                    {section.kind && (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-500">
                        {section.kind}
                      </span>
                    )}
                    {confidenceBadge(section.confidence)}
                    {low && <span className="text-xs text-amber-300">Revisar</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <footer className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 text-sm">
        <span className="text-slate-500">
          {approved ? 'Mapa aprovado — pronto para gerar interações.' : 'Aprove o mapa para avançar.'}
        </span>
        {approved ? (
          <a
            href={`/projeto/${projectId}/visual`}
            className="rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 px-4 py-2 font-semibold text-slate-950 transition hover:brightness-110"
          >
            Escolher visual →
          </a>
        ) : (
          <button
            disabled
            title="Aprove o mapa primeiro"
            className="rounded-lg border border-slate-800 px-4 py-2 text-slate-300 opacity-40"
          >
            Escolher visual →
          </button>
        )}
      </footer>
    </main>
  );
}

function EditableTitle({
  node,
  editing,
  onEdit,
  onSave,
  className,
}: {
  node: MapNode;
  editing: boolean;
  onEdit: () => void;
  onSave: (title: string) => void;
  className?: string;
}) {
  const [value, setValue] = useState(node.title);
  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(value);
        }}
        className="flex-1 rounded border border-sky-500 bg-slate-950 px-2 py-0.5 outline-none"
      />
    );
  }
  return (
    <button onClick={onEdit} className={`text-left hover:text-sky-300 ${className ?? ''}`}>
      {node.title}
    </button>
  );
}
