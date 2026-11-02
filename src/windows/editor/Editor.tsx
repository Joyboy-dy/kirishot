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
import { commands, events, type AfterDraw, type CloseReason, type Settings } from '@/lib/ipc';
import { afterDrawing } from './afterDraw';
import { NO_CHANGE } from '@/lib/settings';
import { t } from '@/i18n';
import { Canvas, type CanvasPointer } from './Canvas';
import { useAutosave } from './autosave';
import { exportImage, type ExportIntent } from './export';
import { buttonView, closeAfterCopy, FEEDBACK, messageVisible, type ButtonState } from './feedback';
import { keyAction, type EditorAction } from './keys';
import { saveState, savedDocOnOpen, type SaveState } from './save';
import { afterChoice, closeDecision, hasUnsavedChanges, type CloseChoice } from './closing';
import { CloseDialog } from './CloseDialog';
import { PickColor, rememberColor } from './ColorPicker';
import { pixelColor } from './colors';
import { baseName, splitName } from './fileName';
import { NameField } from './NameField';
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
import { fit, followBox, zoomAt, type View } from './viewport';

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
  // The stage as state: the transformer reads its nodes while rendering.
  const [stage, setStage] = useState<Konva.Stage | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [history, setHistory] = useState<History | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  // Fitted until the user zooms or pans: the view then follows the window's size (it is measured
  // hidden, before the window shows at its real size).
  const [fitted, setFitted] = useState(true);
  const [seenBox, setSeenBox] = useState(box);
  const moveView = (next: View | ((v: View) => View)) => {
    setFitted(false);
    setView(next);
  };
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
  // The document the capture opened with: a never-saved capture with no change closes quietly.
  const [openedDoc, setOpenedDoc] = useState<Doc | null>(null);
  // Closing with unsaved changes (spec J3 § 3.5): the pending reason, a save in progress, its error.
  const [closing, setClosing] = useState<CloseReason | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(true);
  // The name a first save would use, from the template; and the rename field being open.
  const [plannedName, setPlannedName] = useState('');
  const [renaming, setRenaming] = useState(false);
  // For callbacks that end after another capture may have arrived.
  const shownRef = useRef(shownId);
  useLayoutEffect(() => {
    shownRef.current = shownId;
  });
  // Before a new capture's fit below, which then wins.
  if (box.width !== seenBox.width || box.height !== seenBox.height) {
    setSeenBox(box);
    const next = history && followBox({ view, fitted }, history.present.size, box).view;
    if (next && next !== view) setView(next);
  }
  if (loaded && box.width > 0 && loaded.session.captureId !== shownId) {
    const {
      captureId,
      width,
      height,
      savedPath: knownPath,
      savedDoc: knownDoc,
      document,
    } = loaded.session;
    // Reopened from the history: its annotations come back, still editable.
    const opened = (document && parseDoc(document, captureId)) || newDoc(captureId, width, height);
    setShownId(captureId);
    setHistory(init(opened));
    setSavedPath(knownPath);
    // Annotations kept by the history but never saved to the file show as unsaved.
    setSavedDoc(savedDocOnOpen(opened, knownPath, knownDoc));
    setPendingName(null);
    setOpenedDoc(opened);
    setClosing(null);
    setRenaming(false);
    setPlannedName('');
    setMessage(null);
    setButtons(ALL_IDLE);
    setSelected([]);
    setDraft(null);
    setCropDraft(null);
    setEditing(null);
    setView(fit({ w: width, h: height }, box));
    setFitted(true);
  }

  // The name a first save would use, asked once per capture.
  useEffect(() => {
    if (!shownId) return;
    let current = true;
    void commands.editorPlannedName(shownId).then((r) => {
      if (current && r.status === 'ok') setPlannedName(r.data);
    });
    return () => {
      current = false;
    };
  }, [shownId]);

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
  // The saved file's name, or the one the first save will use (spec J3 § 3.3).
  const shownName = savedPath
    ? baseName(savedPath)
    : pendingName
      ? pendingName + splitName(plannedName).ext
      : plannedName;
  const rename = async (stem: string): Promise<string | null> => {
    if (!doc) return null;
    const r = await commands.editorRename(doc.captureId, savedPath, stem);
    if (r.status === 'error') return r.error.message;
    if (r.data) setSavedPath(r.data);
    else setPendingName(stem);
    return null;
  };
  const fitView = () => {
    if (!doc) return;
    setView(fit({ w: doc.size.w, h: doc.size.h }, box));
    setFitted(true);
  };
  const zoomBy = (factor: number) =>
    moveView((v) => zoomAt(v, factor, { x: box.width / 2, y: box.height / 2 }));
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
  // Resolves to `null` once done, or to the error (a cancelled « Enregistrer sous » is one).
  const runExport = (intent: ExportIntent): Promise<string | null> => {
    if (!doc || !stage || busy) return Promise.resolve(t('editor.busy'));
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
    return exportImage(stage, doc, intent === 'copyAndClose' ? 'copy' : intent, {
      path: savedPath,
      name: pendingName,
    })
      .then((r) => {
        // Another capture arrived meanwhile: this result is not about what is shown.
        if (!closeAfterCopy(exportedId, shownRef.current)) return t('editor.busy');
        if (r.cancelled) {
          mark('idle');
          return t('editor.cancelled');
        }
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
        return null;
      })
      .catch((e: unknown) => {
        mark('idle');
        const text =
          e instanceof Error ? e.message : ((e as { message?: string }).message ?? String(e));
        const failed = t('editor.exportFailed', { message: text });
        setMessage({ text: failed, error: true, at: Date.now() });
        return failed;
      })
      .finally(() => setBusy(false));
  };

  // The editor settings (« Demander avant de fermer », « Après une annotation »), kept in sync
  // with the settings page.
  const [afterDraw, setAfterDraw] = useState<AfterDraw>('keep');
  useEffect(() => {
    const follow = (s: Settings) => {
      setConfirmClose(s.editor.confirmClose);
      setAfterDraw(s.editor.afterDraw);
    };
    void commands.settingsGet().then((r) => {
      if (r.status === 'ok') follow(r.data.settings);
    });
    const unlisten = events.settingsChanged.listen((e) => follow(e.payload.settings));
    return () => void unlisten.then((stop) => stop());
  }, []);

  // What the close does once the capture may go: hide the editor, or let the next capture in.
  const proceedClose = (reason: CloseReason) => {
    setClosing(null);
    setCloseError(null);
    if (reason.kind === 'replace') void commands.editorOpenNext(reason.nextId);
    else void commands.editorClose();
  };
  const requestClose = (reason: CloseReason) => {
    const unsaved = doc && openedDoc ? hasUnsavedChanges(currentSave, doc, openedDoc) : false;
    if (closeDecision(unsaved, confirmClose) === 'close') return proceedClose(reason);
    setCloseError(null);
    setClosing(reason);
  };
  const chooseClose = async (choice: CloseChoice, dontAsk: boolean) => {
    const reason = closing;
    if (!reason) return;
    const plan = afterChoice(choice, dontAsk);
    if (!plan.close) {
      setClosing(null);
      if (reason.kind === 'replace') void commands.editorCancelNext(reason.nextId);
      return;
    }
    if (plan.disableConfirm) void commands.settingsUpdate({ ...NO_CHANGE, confirmClose: false });
    if (plan.save) {
      setCloseBusy(true);
      const failed = await runExport('save');
      setCloseBusy(false);
      if (failed) return setCloseError(failed);
    }
    proceedClose(reason);
  };
  const requestCloseRef = useRef(requestClose);
  useLayoutEffect(() => {
    requestCloseRef.current = requestClose;
  });
  // Rust asks before the window closes or another capture replaces this one.
  useEffect(() => {
    const unlisten = events.editorCloseRequested.listen((e) =>
      requestCloseRef.current(e.payload.reason),
    );
    return () => void unlisten.then((stop) => stop());
  }, []);

  // The eyedropper: the next click on the image picks its colour (spec J3 § 3.4, J3.1).
  const [picking, setPicking] = useState(false);
  const startPicking = () => setPicking(true);
  // The release of the picking click: no text field, no shape.
  const pickedPress = useRef(false);

  const changeTool = (next: ToolId) => {
    setPicking(false);
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
        if (picking) return setPicking(false);
        if (cropDraft) return changeTool('select');
        if (selected.length > 0) return setSelected([]);
        return requestClose({ kind: 'window' });
      case 'rename':
        return setRenaming(true);
      case 'eyedropper':
        return startPicking();
      case 'front':
        if (selected.length === 0) return;
        return record(selected.reduce((d, id) => reorder(d, id, 'front'), doc));
      case 'back':
        if (selected.length === 0) return;
        return record([...selected].reverse().reduce((d, id) => reorder(d, id, 'back'), doc));
      case 'save':
        // Nothing changed since the last save: no second identical file (spec J3 § 3.2).
        if (currentSave === 'clean') return;
        return void runExport('save');
      case 'copy':
      case 'saveAs':
      case 'copyAndClose':
        return void runExport(action.type);
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
        return moveView((v) => zoomAt(v, 1 / v.scale, { x: box.width / 2, y: box.height / 2 }));
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
    if (picking && loaded) {
      setPicking(false);
      pickedPress.current = true;
      const color = pixelColor(loaded.pixels, p.at);
      if (!color) return;
      changeStyle({ color });
      void rememberColor(color);
      return;
    }
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
      const id = newId();
      record(
        add(doc, {
          id,
          tool: 'step',
          at: p.at,
          color: style.color,
          size: strokeWidth(doc.size, style.size),
        }),
      );
      return drawn(id);
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
    if (pickedPress.current) {
      pickedPress.current = false;
      return;
    }
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
    if (!done) return;
    record(add(doc, done));
    drawn(done.id);
  };

  // A new annotation: keep the tool, or select it, as the setting says.
  const drawn = (id: string) => {
    const next = afterDrawing(afterDraw, id);
    if (!next) return;
    setTool(next.tool);
    setSelected(next.selected);
  };

  const finishText = (a: TextAnnotation, text: string) => {
    setEditing(null);
    if (!doc) return;
    const exists = doc.annotations.some((x) => x.id === a.id);
    const trimmed = text.replace(/\s+$/, '');
    if (!trimmed) return exists && record(remove(doc, [a.id]));
    if (exists) return record(update(doc, a.id, { text: trimmed }));
    record(add(doc, { ...a, text: trimmed }));
    drawn(a.id);
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
  // What the controls show: the first selected annotation's settings, or the drawing style.
  const shownStyle: StylePatch =
    tool === 'select' && selectedAnnotations[0] && doc
      ? styleOf(selectedAnnotations[0], doc.size)
      : style;
  const shownOptions = tool === 'select' ? optionsFor(selectedAnnotations) : toolOptions(tool);

  return (
    <div
      // The page never scrolls: only the image area pans and zooms (spec J2.1 § 4.1).
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--k-bg)', color: 'var(--k-text)' }}
    >
      <PickColor.Provider value={startPicking}>
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
          onSave={() => act({ type: 'save' })}
          saveState={currentSave}
          onSaveVersion={() => runExport('saveVersion')}
          onSaveAs={() => runExport('saveAs')}
          selectionActions={
            selected.length > 0
              ? {
                  onFront: () => act({ type: 'front' }),
                  onBack: () => act({ type: 'back' }),
                  onDuplicate: () => act({ type: 'duplicate' }),
                  onDelete: () => act({ type: 'delete' }),
                }
              : null
          }
          onCopyAndClose={() => runExport('copyAndClose')}
        />
      </PickColor.Provider>
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
            tool={tool}
            picking={picking}
            onView={moveView}
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
                  // While picking, a click on an annotation reaches the eyedropper.
                  draggable: tool === 'select' && !picking,
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
                {tool === 'select' && !picking && (
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
        {closing && (
          <CloseDialog
            busy={closeBusy}
            error={closeError}
            onChoice={(choice, dontAsk) => void chooseClose(choice, dontAsk)}
          />
        )}
        {editing && (
          <TextEditor a={editing} view={view} onDone={(text) => finishText(editing, text)} />
        )}
      </div>
      <StatusBar
        name={
          <NameField
            name={shownName}
            pending={savedPath === null}
            editing={renaming}
            onEditing={setRenaming}
            onRename={rename}
          />
        }
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
