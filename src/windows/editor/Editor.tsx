import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import {
  add,
  duplicate,
  newDoc,
  newId,
  remove,
  reorder,
  setCrop,
  translate,
  update,
  type Annotation,
  type Doc,
  type Point,
  type Rect,
} from '@/editor/document';
import { commit, init, redo, undo, type History } from '@/editor/history';
import { PALETTE, strokeWidth } from '@/editor/style';
import { commands } from '@/lib/ipc';
import { t } from '@/i18n';
import { Canvas, type CanvasPointer } from './Canvas';
import { useAutosave } from './autosave';
import { ContextBubble } from './ContextBubble';
import { exportImage, type ExportIntent } from './export';
import { keyAction, type EditorAction } from './keys';
import { StatusBar } from './StatusBar';
import { TopBar, type Style } from './TopBar';
import { AnnotationNode } from './tools/AnnotationNode';
import type { ToolId } from './tools/catalog';
import { begin, DRAG_TOOLS, extend, finish } from './tools/create';
import { CropShade, SelectionUi } from './tools/SelectionUi';
import { textPointer } from './tools/text';
import { TextEditor } from './tools/TextEditor';
import { useEditorSession } from './useEditorSession';
import { fit, zoomAt, type View } from './viewport';

const DEFAULT_STYLE: Style = { color: PALETTE[0], size: 2, fill: false, shadow: true };
type TextAnnotation = Extract<Annotation, { tool: 'text' }>;

function cropBox(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** The style choice applied to an existing annotation (spec J2 § 4.1). */
function restyle(
  a: Annotation,
  style: Partial<Style>,
  image: { w: number; h: number },
): Annotation {
  const width = style.size ? strokeWidth(image, style.size) : undefined;
  switch (a.tool) {
    case 'arrow':
    case 'line':
    case 'pen':
      return {
        ...a,
        stroke: {
          ...a.stroke,
          color: style.color ?? a.stroke.color,
          width: width ?? a.stroke.width,
        },
        ...(a.tool === 'arrow' && style.shadow !== undefined ? { shadow: style.shadow } : {}),
      };
    case 'rect':
    case 'ellipse':
      return {
        ...a,
        stroke: {
          ...a.stroke,
          color: style.color ?? a.stroke.color,
          width: width ?? a.stroke.width,
        },
        fill:
          style.fill === undefined && !style.color
            ? a.fill
            : {
                kind: (style.fill ?? a.fill.kind !== 'none') ? 'translucent' : 'none',
                color: style.color ?? a.fill.color,
              },
        shadow: style.shadow ?? a.shadow,
      };
    case 'highlighter':
      return { ...a, color: style.color ?? a.color, width: width ? width * 4 : a.width };
    case 'text':
      return { ...a, color: style.color ?? a.color, size: width ? width * 6 : a.size };
    case 'step':
      return { ...a, color: style.color ?? a.color, size: width ?? a.size };
    case 'pixelate':
      return a;
  }
}

/** The annotation editor (spec J2 § 4). */
export function Editor() {
  const loaded = useEditorSession();
  // The stage as state: the bubble and the transformer read its nodes while rendering.
  const [stage, setStage] = useState<Konva.Stage | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [history, setHistory] = useState<History | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [tool, setTool] = useState<ToolId>('arrow');
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [panning, setPanning] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [cropDraft, setCropDraft] = useState<Rect | null>(null);
  const [editing, setEditing] = useState<TextAnnotation | null>(null);
  const anchor = useRef<Point | null>(null);
  // The document before a handle drag: the whole drag is one undo step.
  const dragBase = useRef<Doc | null>(null);

  // A new capture: fresh document and fitted view, set while rendering (React's pattern for
  // state that follows a prop), once the box has a size.
  const [shownId, setShownId] = useState<string | null>(null);
  if (loaded && box.width > 0 && loaded.session.captureId !== shownId) {
    const { captureId, width, height } = loaded.session;
    setShownId(captureId);
    setHistory(init(newDoc(captureId, width, height)));
    setMessage(null);
    setSelected([]);
    setDraft(null);
    setCropDraft(null);
    setEditing(null);
    setView(fit({ w: width, h: height }, box));
  }

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setBox({ width: el.clientWidth, height: el.clientHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const doc = history?.present ?? null;
  useAutosave(doc);
  const image = doc ? doc.size : { w: 1, h: 1 };
  const record = (next: Doc) => setHistory((h) => h && commit(h, next));
  const fitView = () => {
    if (doc) setView(fit({ w: doc.size.w, h: doc.size.h }, box));
  };
  const zoomBy = (factor: number) =>
    setView((v) => zoomAt(v, factor, { x: box.width / 2, y: box.height / 2 }));
  const [busy, setBusy] = useState(false);
  const runExport = (intent: ExportIntent) => {
    if (!doc || !stage || busy) return;
    setBusy(true);
    setSelected([]);
    exportImage(stage, doc, intent)
      .then((r) => {
        if (r.cancelled) return;
        const name = r.saved?.split(/[\\/]/).pop() ?? '';
        const text = r.saved
          ? r.usedFallback
            ? t('editor.savedFallback', { name })
            : t('editor.saved', { name })
          : t('editor.copied');
        setMessage({ text, error: false });
      })
      .catch((e: unknown) => {
        const text =
          e instanceof Error ? e.message : ((e as { message?: string }).message ?? String(e));
        setMessage({ text: t('editor.exportFailed', { message: text }), error: true });
      })
      .finally(() => setBusy(false));
  };

  const changeTool = (next: ToolId) => {
    setTool(next);
    setDraft(null);
    if (next !== 'select') setSelected([]);
    if (next === 'crop' && doc)
      setCropDraft(doc.crop ?? { x: 0, y: 0, width: doc.size.w, height: doc.size.h });
    else setCropDraft(null);
  };

  const applyStyle = (patch: Partial<Style>) => {
    setStyle((s) => ({ ...s, ...patch }));
    if (!doc || selected.length === 0) return;
    let next = doc;
    for (const a of doc.annotations.filter((x) => selected.includes(x.id)))
      next = update(next, a.id, restyle(a, patch, doc.size));
    record(next);
  };

  const changeSelected = (patch: (a: Annotation) => Partial<Annotation>) => {
    if (!doc) return;
    let next = doc;
    for (const a of doc.annotations.filter((x) => selected.includes(x.id)))
      next = update(next, a.id, patch(a));
    record(next);
  };

  const act = (action: EditorAction) => {
    if (!doc) return;
    switch (action.type) {
      case 'tool':
        return changeTool(action.tool);
      case 'size':
        return applyStyle({ size: action.step });
      case 'undo':
        return setHistory((h) => h && undo(h));
      case 'redo':
        return setHistory((h) => h && redo(h));
      case 'selectAll':
        setTool('select');
        return setSelected(doc.annotations.map((a) => a.id));
      case 'duplicate': {
        if (selected.length === 0) return;
        const copy = duplicate(doc, selected, { x: 12, y: 12 });
        record(copy.doc);
        return setSelected(copy.ids);
      }
      case 'delete':
        if (selected.length === 0) return;
        record(remove(doc, selected));
        return setSelected([]);
      case 'nudge': {
        if (selected.length === 0) return;
        let next = doc;
        for (const a of doc.annotations.filter((x) => selected.includes(x.id)))
          next = update(next, a.id, translate(a, { x: action.dx, y: action.dy }));
        return record(next);
      }
      case 'escape':
        if (cropDraft) return changeTool('select');
        if (selected.length > 0) return setSelected([]);
        return void commands.editorClose();
      case 'copy':
      case 'save':
      case 'saveAs':
      case 'copyAndClose':
        return runExport(action.type);
    }
  };

  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useLayoutEffect(() => {
    keysRef.current = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === ' ' && !e.repeat) {
        setPanning(true);
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && e.key === '0') return (e.preventDefault(), fitView());
      if (e.ctrlKey && e.key === '1') {
        e.preventDefault();
        return setView((v) => zoomAt(v, 1 / v.scale, { x: box.width / 2, y: box.height / 2 }));
      }
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) return (e.preventDefault(), zoomBy(1.25));
      if (e.ctrlKey && e.key === '-') return (e.preventDefault(), zoomBy(0.8));
      if (cropDraft && e.key === 'Enter' && doc) {
        e.preventDefault();
        record(setCrop(doc, cropDraft.width > 2 && cropDraft.height > 2 ? cropDraft : null));
        return changeTool('select');
      }
      const action = keyAction({
        key: e.key,
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        editingText: false,
      });
      if (!action) return;
      e.preventDefault();
      act(action);
    };
  });
  useEffect(() => {
    const down = (e: KeyboardEvent) => keysRef.current(e);
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') setPanning(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const onDown = (p: CanvasPointer) => {
    if (!doc) return;
    if (tool === 'select') {
      if (p.target === p.target.getStage()) setSelected([]);
      return;
    }
    if (tool === 'text') {
      // The field opens on the release (spec J2.1 § 3.2): keep the press from moving the focus,
      // unless a field is open, which this press closes (its blur commits it).
      textPressEnded.current = editing !== null;
      if (!editing) p.preventDefault();
      return;
    }
    if (tool === 'step') {
      record(
        add(doc, {
          id: newId(),
          tool: 'step',
          at: p.at,
          color: style.color,
          size: strokeWidth(doc.size, style.size),
        }),
      );
      return;
    }
    anchor.current = p.at;
    if (tool === 'crop') return setCropDraft({ ...p.at, width: 0, height: 0 });
    if (DRAG_TOOLS.includes(tool)) setDraft(begin(tool, p.at, style, doc.size));
  };

  const onMove = (p: CanvasPointer) => {
    const from = anchor.current;
    if (!from) return;
    if (tool === 'crop') return setCropDraft(cropBox(from, p.at));
    setDraft((d) => d && extend(d, from, p.at, p));
  };

  const textPressEnded = useRef(false);
  const onUp = (p: CanvasPointer) => {
    if (tool === 'text' && doc) {
      const node = p.target.findAncestor('.annotation', true);
      const hit = doc.annotations.find((a) => a.id === node?.id() && a.tool === 'text');
      const action = textPointer('up', hit?.id ?? null, textPressEnded.current);
      textPressEnded.current = false;
      if (action.type === 'edit' && hit?.tool === 'text') setEditing(hit);
      if (action.type === 'create')
        setEditing({
          id: newId(),
          tool: 'text',
          at: p.at,
          text: '',
          size: strokeWidth(doc.size, style.size) * 6,
          color: style.color,
          style: 'plain',
        });
      return;
    }
    anchor.current = null;
    if (!doc || !draft) return;
    const done = finish(draft);
    setDraft(null);
    if (done) record(add(doc, done));
  };

  const finishText = (a: TextAnnotation, text: string) => {
    setEditing(null);
    if (!doc) return;
    const exists = doc.annotations.some((x) => x.id === a.id);
    const trimmed = text.replace(/\s+$/, '');
    if (!trimmed) return exists && record(remove(doc, [a.id]));
    record(exists ? update(doc, a.id, { text: trimmed }) : add(doc, { ...a, text: trimmed }));
  };

  const onHandle = (id: string, patch: Partial<Annotation>, final: boolean) => {
    setHistory((h) => {
      if (!h) return h;
      const base = dragBase.current ?? h.present;
      const next = update(h.present, id, patch);
      if (!final) {
        dragBase.current = base;
        return { ...h, present: next };
      }
      dragBase.current = null;
      return { past: [...h.past, base].slice(-200), present: next, future: [] };
    });
  };

  const selectedAnnotations = doc ? doc.annotations.filter((a) => selected.includes(a.id)) : [];
  // The bubble sits under the selection, in the canvas area's CSS pixels.
  let bubbleAt: { x: number; y: number } | null = null;
  if (tool === 'select' && selectedAnnotations.length > 0 && stage) {
    const rects = selected
      .map((id) => stage?.findOne(`#${id}`)?.getClientRect())
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
    if (rects.length > 0) {
      const left = Math.min(...rects.map((r) => r.x));
      const right = Math.max(...rects.map((r) => r.x + r.width));
      const bottom = Math.max(...rects.map((r) => r.y + r.height));
      const top = Math.min(...rects.map((r) => r.y));
      const below = bottom + 12 + 40 < box.height;
      bubbleAt = { x: (left + right) / 2, y: below ? bottom + 12 : Math.max(8, top - 52) };
    }
  }

  const cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  return (
    <div
      className="flex h-screen flex-col"
      style={{ background: 'var(--k-bg)', color: 'var(--k-text)' }}
    >
      <TopBar
        tool={tool}
        style={style}
        canUndo={(history?.past.length ?? 0) > 0}
        canRedo={(history?.future.length ?? 0) > 0}
        busy={!doc || busy}
        onTool={changeTool}
        onStyle={applyStyle}
        onUndo={() => setHistory((h) => h && undo(h))}
        onRedo={() => setHistory((h) => h && redo(h))}
        onCopy={() => runExport('copy')}
        onSave={() => runExport('save')}
        onCopyAndClose={() => runExport('copyAndClose')}
      />
      <div
        ref={boxRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ background: 'var(--k-surface-2)' }}
      >
        {loaded && doc && box.width > 0 && (
          <Canvas
            ref={setStage}
            bitmap={loaded.bitmap}
            view={view}
            size={box}
            panning={panning}
            cursor={cursor}
            onView={setView}
            onDown={onDown}
            onMove={onMove}
            onUp={onUp}
            onDoubleClick={() => {}}
            annotations={doc.annotations.map((a) => (
              <AnnotationNode
                key={a.id}
                a={a}
                doc={doc}
                pixels={loaded.pixels}
                events={{
                  draggable: tool === 'select',
                  onSelect: (id, more) =>
                    setSelected((s) =>
                      more
                        ? s.includes(id)
                          ? s.filter((x) => x !== id)
                          : [...s, id]
                        : s.includes(id)
                          ? s
                          : [id],
                    ),
                  onMoved: (id, dx, dy, copy) => {
                    const ids = selected.includes(id) ? selected : [id];
                    let next = copy ? duplicate(doc, ids, { x: 0, y: 0 }).doc : doc;
                    for (const x of doc.annotations.filter((y) => ids.includes(y.id)))
                      next = update(next, x.id, translate(x, { x: dx, y: dy }));
                    record(next);
                  },
                  onEditText: (id) => {
                    const a = doc.annotations.find((x) => x.id === id);
                    if (a?.tool === 'text') setEditing(a);
                  },
                }}
              />
            ))}
            draft={
              draft && (
                <AnnotationNode
                  live
                  a={draft}
                  doc={doc}
                  pixels={loaded.pixels}
                  events={{
                    draggable: false,
                    onSelect: () => {},
                    onMoved: () => {},
                    onEditText: () => {},
                  }}
                />
              )
            }
            overlay={
              <>
                {tool === 'select' && (
                  <SelectionUi
                    selected={selectedAnnotations}
                    stage={stage}
                    scale={view.scale}
                    onChange={onHandle}
                  />
                )}
                {cropDraft && <CropShade crop={cropDraft} image={image} />}
                {!cropDraft && doc.crop && <CropShade crop={doc.crop} image={image} />}
              </>
            }
          />
        )}
        {editing && (
          <TextEditor a={editing} view={view} onDone={(text) => finishText(editing, text)} />
        )}
        {bubbleAt && (
          <ContextBubble
            selected={selectedAnnotations}
            at={bubbleAt}
            onDash={(dash) =>
              changeSelected((a) => ('stroke' in a ? { stroke: { ...a.stroke, dash } } : {}))
            }
            onOpacity={(opacity) =>
              changeSelected((a) => ('stroke' in a ? { stroke: { ...a.stroke, opacity } } : {}))
            }
            onTextStyle={(s) => changeSelected((a) => (a.tool === 'text' ? { style: s } : {}))}
            onFront={() => doc && record(selected.reduce((d, id) => reorder(d, id, 'front'), doc))}
            onBack={() =>
              doc && record([...selected].reverse().reduce((d, id) => reorder(d, id, 'back'), doc))
            }
            onDelete={() => act({ type: 'delete' })}
          />
        )}
      </div>
      <StatusBar
        width={doc?.crop?.width ?? doc?.size.w ?? 0}
        height={doc?.crop?.height ?? doc?.size.h ?? 0}
        annotations={doc?.annotations.length ?? 0}
        zoom={view.scale}
        message={message}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onFit={fitView}
      />
    </div>
  );
}
