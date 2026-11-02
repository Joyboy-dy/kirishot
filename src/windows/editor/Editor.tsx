import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import {
  add,
  duplicate,
  newDoc,
  newId,
  normalizeDoc,
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
import { commit, init, preview, redo, settle, undo, type History } from '@/editor/history';
import { PALETTE, strokeWidth } from '@/editor/style';
import { commands } from '@/lib/ipc';
import { t } from '@/i18n';
import { Canvas, type CanvasPointer } from './Canvas';
import { useAutosave } from './autosave';
import { ContextBubble } from './ContextBubble';
import { exportImage, type ExportIntent } from './export';
import { buttonView, closeAfterCopy, FEEDBACK, messageVisible, type ButtonState } from './feedback';
import { keyAction, type EditorAction } from './keys';
import { saveState, type SaveState } from './save';
import { toolbarLayout } from './layout';
import { StatusBar } from './StatusBar';
import type { Style } from './StylePopover';
import { TopBar } from './TopBar';
import { AnnotationNode } from './tools/AnnotationNode';
import type { ToolId } from './tools/catalog';
import { begin, DRAG_TOOLS, extend, finish } from './tools/create';
import { applyStyle, optionsFor, styleOf, toolOptions, type StylePatch } from './tools/options';
import { CropShade, SelectionUi } from './tools/SelectionUi';
import { textPointer } from './tools/text';
import { TextEditor } from './tools/TextEditor';
import { useEditorSession } from './useEditorSession';
import { fit, zoomAt, type View } from './viewport';

type ExportButton = 'copy' | 'save' | 'main';

/** A document autosaved earlier, or `null` when it is unreadable or of another capture. */
function parseDoc(json: string, captureId: string): Doc | null {
  try {
    const doc = normalizeDoc(JSON.parse(json) as Doc);
    return doc.captureId === captureId ? doc : null;
  } catch {
    return null;
  }
}
const IDLE: ButtonState = { phase: 'idle', since: 0 };
const ALL_IDLE: Record<ExportButton, ButtonState> = { copy: IDLE, save: IDLE, main: IDLE };

const DEFAULT_STYLE: Style = {
  color: PALETTE[0],
  size: 2,
  fill: 'none',
  shadow: true,
  dash: 'solid',
  opacity: 1,
  textStyle: 'plain',
  strength: 16,
};
type TextAnnotation = Extract<Annotation, { tool: 'text' }>;

function cropBox(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
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
  const [message, setMessage] = useState<{ text: string; error: boolean; at: number } | null>(null);
  const [buttons, setButtons] = useState(ALL_IDLE);
  // The clock of the feedback: it only ticks while a button or a message is showing a result.
  const [now, setNow] = useState(0);
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
  // The file this capture was saved to, the document it then had, and a name chosen before the
  // first save (spec J3 § 3.2, § 3.3).
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [savedDoc, setSavedDoc] = useState<Doc | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  // For callbacks that end after another capture may have arrived.
  const shownRef = useRef(shownId);
  useLayoutEffect(() => {
    shownRef.current = shownId;
  });
  if (loaded && box.width > 0 && loaded.session.captureId !== shownId) {
    const { captureId, width, height, savedPath: knownPath, document } = loaded.session;
    // Reopened from the history: its annotations come back, still editable.
    const opened = (document && parseDoc(document, captureId)) || newDoc(captureId, width, height);
    setShownId(captureId);
    setHistory(init(opened));
    setSavedPath(knownPath);
    setSavedDoc(knownPath ? opened : null);
    setPendingName(null);
    setMessage(null);
    setButtons(ALL_IDLE);
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
  const currentSave: SaveState = doc ? saveState(doc, savedDoc, savedPath) : 'never';
  const fitView = () => {
    if (doc) setView(fit({ w: doc.size.w, h: doc.size.h }, box));
  };
  const zoomBy = (factor: number) =>
    setView((v) => zoomAt(v, factor, { x: box.width / 2, y: box.height / 2 }));
  const [busy, setBusy] = useState(false);
  const ticking = Object.values(buttons).some((b) => b.phase !== 'idle') || Boolean(message);
  useEffect(() => {
    if (!ticking) return;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      setButtons((all) => {
        const expired = (Object.keys(all) as ExportButton[]).filter(
          (k) => all[k].phase === 'done' && buttonView(all[k], at) === 'icon',
        );
        if (expired.length === 0) return all;
        return { ...all, ...Object.fromEntries(expired.map((k) => [k, IDLE])) };
      });
      setMessage((m) => (m && !messageVisible(m, at) ? null : m));
    };
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [ticking]);

  // The result shows on the button used (a check) and in the status bar (spec J2.1 § 4.2).
  const runExport = (intent: ExportIntent) => {
    if (!doc || !stage || busy) return;
    const key: ExportButton =
      intent === 'copy' ? 'copy' : intent === 'copyAndClose' ? 'main' : 'save';
    const mark = (phase: ButtonState['phase']) =>
      setButtons((all) => ({
        ...all,
        [key]: phase === 'idle' ? IDLE : { phase, since: Date.now() },
      }));
    setBusy(true);
    setSelected([]);
    setMessage(null);
    mark('busy');
    // Copy and close: copy, show the check, then close (closing at once would hide it).
    const exportedId = doc.captureId;
    const exportedDoc = doc;
    exportImage(stage, doc, intent === 'copyAndClose' ? 'copy' : intent, {
      path: savedPath,
      name: pendingName,
    })
      .then((r) => {
        // Another capture arrived meanwhile: this result is not about what is shown.
        if (!closeAfterCopy(exportedId, shownRef.current)) return;
        if (r.cancelled) return mark('idle');
        mark('done');
        if (r.saved) {
          setSavedPath(r.saved);
          setSavedDoc(exportedDoc);
          setPendingName(null);
        }
        const name = r.saved?.split(/[\\/]/).pop() ?? '';
        const text = r.saved
          ? r.usedFallback
            ? t('editor.savedFallback', { name })
            : t('editor.saved', { name })
          : t('editor.copied');
        setMessage({ text, error: false, at: Date.now() });
        if (intent === 'copyAndClose')
          window.setTimeout(() => {
            if (closeAfterCopy(exportedId, shownRef.current)) void commands.editorClose();
          }, FEEDBACK.closeDelayMs);
      })
      .catch((e: unknown) => {
        mark('idle');
        const text =
          e instanceof Error ? e.message : ((e as { message?: string }).message ?? String(e));
        setMessage({
          text: t('editor.exportFailed', { message: text }),
          error: true,
          at: Date.now(),
        });
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

  // A setting becomes the drawing style and, with a selection, applies to it in one undo step.
  // A setting becomes the drawing style and, with a selection, applies to it in one undo step;
  // a live change (the opacity slider being dragged) is one step from its start to its end.
  const liveBase = useRef<Doc | null>(null);
  const changeStyle = (patch: StylePatch, live = false) => {
    setStyle((s) => ({ ...s, ...patch }));
    if (!doc || selected.length === 0) return;
    if (!live) return record(applyStyle(doc, selected, patch));
    liveBase.current ??= doc;
    setHistory((h) => h && preview(h, applyStyle(h.present, selected, patch)));
  };
  const settleStyle = () => {
    const base = liveBase.current;
    liveBase.current = null;
    if (base) setHistory((h) => h && settle(h, base));
  };

  const act = (action: EditorAction) => {
    if (!doc) return;
    switch (action.type) {
      case 'tool':
        return changeTool(action.tool);
      case 'size':
        return changeStyle({ size: action.step });
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
      case 'save':
        // Nothing changed since the last save: no second identical file (spec J3 § 3.2).
        if (currentSave === 'clean') return;
        return runExport('save');
      case 'copy':
      case 'saveAs':
      case 'copyAndClose':
        return runExport(action.type);
    }
  };

  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useLayoutEffect(() => {
    keysRef.current = (e: KeyboardEvent) => {
      // A key a control already handled (Échap closing a menu) must not act on the editor too.
      if (editing || e.defaultPrevented) return;
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
        handled: e.defaultPrevented,
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
          style: style.textStyle,
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
  let bubbleSel: Rect | null = null;
  if (tool === 'select' && selectedAnnotations.length > 0 && stage) {
    const rects = selected
      .map((id) => stage?.findOne(`#${id}`)?.getClientRect())
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
    if (rects.length > 0) {
      const left = Math.min(...rects.map((r) => r.x));
      const top = Math.min(...rects.map((r) => r.y));
      const right = Math.max(...rects.map((r) => r.x + r.width));
      const bottom = Math.max(...rects.map((r) => r.y + r.height));
      bubbleSel = { x: left, y: top, width: right - left, height: bottom - top };
    }
  }
  // What the controls show: the first selected annotation's settings, or the drawing style.
  const shownStyle: StylePatch =
    tool === 'select' && selectedAnnotations[0] && doc
      ? styleOf(selectedAnnotations[0], doc.size)
      : style;
  const shownOptions = tool === 'select' ? optionsFor(selectedAnnotations) : toolOptions(tool);

  const cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  return (
    <div
      // The page never scrolls: only the image area pans and zooms (spec J2.1 § 4.1).
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--k-bg)', color: 'var(--k-text)' }}
    >
      <TopBar
        tool={tool}
        options={shownOptions}
        value={shownStyle}
        canUndo={(history?.past.length ?? 0) > 0}
        canRedo={(history?.future.length ?? 0) > 0}
        busy={!doc || busy}
        views={{
          copy: buttonView(buttons.copy, now),
          save: buttonView(buttons.save, now),
          main: buttonView(buttons.main, now),
        }}
        onTool={changeTool}
        onStyle={changeStyle}
        onStyleSettled={settleStyle}
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
        {bubbleSel && (
          <ContextBubble
            selected={selectedAnnotations}
            sel={bubbleSel}
            area={box}
            value={shownStyle}
            onStyle={changeStyle}
            onStyleSettled={settleStyle}
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
        compact={toolbarLayout(box.width) === 'narrow'}
        zoom={view.scale}
        message={message && messageVisible(message, now) ? message : null}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onFit={fitView}
      />
    </div>
  );
}
