import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { newDoc } from '@/editor/document';
import { init, redo, undo, type History } from '@/editor/history';
import { PALETTE } from '@/editor/style';
import { commands } from '@/lib/ipc';
import { t } from '@/i18n';
import { Canvas } from './Canvas';
import { StatusBar } from './StatusBar';
import { TopBar, type Style } from './TopBar';
import type { ToolId } from './tools/catalog';
import { useEditorSession } from './useEditorSession';
import { fit, zoomAt, type View } from './viewport';

const DEFAULT_STYLE: Style = { color: PALETTE[0], size: 2, fill: false, shadow: true };

/** The annotation editor (spec J2 § 4). */
export function Editor() {
  const loaded = useEditorSession();
  const stageRef = useRef<Konva.Stage>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [history, setHistory] = useState<History | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [tool, setTool] = useState<ToolId>('arrow');
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [panning, setPanning] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // A new capture: fresh document and fitted view, set while rendering (React's pattern for
  // state that follows a prop), once the box has a size.
  const [shownId, setShownId] = useState<string | null>(null);
  if (loaded && box.width > 0 && loaded.session.captureId !== shownId) {
    const { captureId, width, height } = loaded.session;
    setShownId(captureId);
    setHistory(init(newDoc(captureId, width, height)));
    setMessage(null);
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
  const fitView = () => {
    if (doc) setView(fit({ w: doc.size.w, h: doc.size.h }, box));
  };
  const zoomBy = (factor: number) =>
    setView((v) => zoomAt(v, factor, { x: box.width / 2, y: box.height / 2 }));

  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useLayoutEffect(() => {
    keysRef.current = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat) {
        setPanning(true);
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && e.key === '0') return (e.preventDefault(), fitView());
      if (e.ctrlKey && e.key === '1')
        return (
          e.preventDefault(),
          setView((v) => zoomAt(v, 1 / v.scale, { x: box.width / 2, y: box.height / 2 }))
        );
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) return (e.preventDefault(), zoomBy(1.25));
      if (e.ctrlKey && e.key === '-') return (e.preventDefault(), zoomBy(0.8));
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z')
        return (e.preventDefault(), setHistory((h) => h && undo(h)));
      if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')))
        return (e.preventDefault(), setHistory((h) => h && redo(h)));
      if (e.key === 'Escape') void commands.editorClose();
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

  const notYet = () => setMessage({ text: t('editor.soon'), error: false });

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
        busy={!doc}
        onTool={setTool}
        onStyle={(patch) => setStyle((s) => ({ ...s, ...patch }))}
        onUndo={() => setHistory((h) => h && undo(h))}
        onRedo={() => setHistory((h) => h && redo(h))}
        onCopy={notYet}
        onSave={notYet}
        onCopyAndClose={notYet}
      />
      <div
        ref={boxRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ background: 'var(--k-surface-2)' }}
      >
        {loaded && doc && box.width > 0 && (
          <Canvas
            ref={stageRef}
            bitmap={loaded.bitmap}
            view={view}
            size={box}
            panning={panning}
            cursor="crosshair"
            onView={setView}
            onDown={() => {}}
            onMove={() => {}}
            onUp={() => {}}
            onDoubleClick={() => {}}
            annotations={null}
            draft={null}
            overlay={null}
          />
        )}
      </div>
      <StatusBar
        width={doc?.size.w ?? 0}
        height={doc?.size.h ?? 0}
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
