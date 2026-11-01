import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { cssToPhysical, isTooSmall, type Point } from '@/lib/geometry';
import { commands, type CommitTarget, type OverlaySession, type Rect } from '@/lib/ipc';
import { KeyHints } from './KeyHints';
import { Magnifier } from './Magnifier';
import { SelectionLayer } from './SelectionLayer';
import { Toolbar } from './Toolbar';
import { useOverlaySession } from './useOverlaySession';
import {
  initialState,
  step,
  type Ctx,
  type Mode,
  type Outcome,
  type SelEvent,
  type SelState,
} from './selection';

const KEYS = new Set(['Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

function contains(r: Rect, p: Point) {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}

function report(result: Promise<{ status: 'ok' | 'error'; error?: unknown }>) {
  void result.then((r) => {
    if (r.status === 'error') console.error(r.error);
  });
}

/** One monitor's frozen screen and the selection drawn on it (spec § 3.2). */
export function Overlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sel, setSel] = useState<SelState>(initialState);
  const selRef = useRef<SelState>(initialState);
  const [mode, setMode] = useState<Mode>('region');
  const [pointer, setPointer] = useState<Point | null>(null);
  const [active, setActive] = useState(false);

  const setSelection = (next: SelState) => {
    selRef.current = next;
    setSel(next);
  };

  const session = useOverlaySession(canvasRef, {
    onSession: (s) => {
      setSelection(initialState);
      setMode('region');
      setActive(s.cursor !== null);
      setPointer(s.cursor);
    },
    onClaimedElsewhere: () => setSelection(initialState),
    onReset: () => {
      setSelection(initialState);
      setPointer(null);
    },
  });
  // Event handlers read the latest values through refs, updated after each render.
  const sessionRef = useRef<OverlaySession | null>(null);
  const modeRef = useRef(mode);
  useLayoutEffect(() => {
    sessionRef.current = session;
    modeRef.current = mode;
  });

  const act = (outcome: Outcome) => {
    const s = sessionRef.current;
    if (!s) return;
    if (outcome.type === 'claim') report(commands.overlayClaim());
    if (outcome.type === 'cancel') report(commands.overlayCancel());
    if (outcome.type === 'commit') report(commands.overlayCommit(s.captureId, outcome.target));
  };

  const dispatch = (e: SelEvent) => {
    const s = sessionRef.current;
    if (!s) return;
    const ctx: Ctx = {
      mode: modeRef.current,
      windows: s.windows,
      bounds: { width: s.monitor.width, height: s.monitor.height },
      commitOnRelease: s.commitOnRelease,
    };
    const { state, outcome } = step(selRef.current, e, ctx);
    setSelection(state);
    act(outcome);
  };
  const dispatchRef = useRef(dispatch);
  useLayoutEffect(() => {
    dispatchRef.current = dispatch;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!KEYS.has(e.key)) return;
      e.preventDefault();
      dispatchRef.current({ type: 'key', key: e.key, shift: e.shiftKey });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const scale = session?.monitor.scale ?? window.devicePixelRatio;
  const toPhysical = (e: PointerEvent | MouseEvent) =>
    cssToPhysical({ x: e.clientX, y: e.clientY }, scale);
  const currentRect = 'rect' in sel ? sel.rect : null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = toPhysical(e);
    const handle = (e.target as HTMLElement).dataset.handle ?? null;
    dispatch({
      type: 'pointerDown',
      at,
      handle: handle as never,
      inside: currentRect !== null && contains(currentRect, at),
    });
  };

  const commit = (target: CommitTarget) => act({ type: 'commit', target });
  const changeMode = (next: Mode) => {
    setMode(next);
    setSelection(initialState);
  };

  // While dragging, a selection smaller than 4×4 px still shows the hovered window.
  const selRect =
    currentRect && !(sel.kind === 'dragging' && isTooSmall(currentRect)) ? currentRect : null;
  const hover = sel.kind === 'idle' || sel.kind === 'dragging' ? sel.hover : null;
  const showMagnifier =
    active &&
    pointer !== null &&
    (sel.kind === 'idle' || sel.kind === 'dragging' || sel.kind === 'resizing');
  const cursor =
    sel.kind === 'moving' || (sel.kind === 'adjusting' && pointer && contains(sel.rect, pointer))
      ? 'move'
      : 'crosshair';

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        const at = toPhysical(e);
        setPointer(at);
        dispatch({ type: 'pointerMove', at, shift: e.shiftKey });
      }}
      onPointerUp={(e) => dispatch({ type: 'pointerUp', at: toPhysical(e) })}
      onDoubleClick={(e) =>
        dispatch({
          type: 'doubleClick',
          inside: currentRect !== null && contains(currentRect, toPhysical(e)),
        })
      }
      onPointerEnter={() => {
        setActive(true);
        void getCurrentWindow().setFocus();
      }}
      onPointerLeave={() => {
        setActive(false);
        setPointer(null);
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-screen w-screen" />
      {session && (
        <>
          <SelectionLayer
            scale={scale}
            rect={selRect}
            hover={hover}
            withHandles={sel.kind !== 'idle' && sel.kind !== 'dragging'}
          />
          {showMagnifier && <Magnifier source={canvasRef} at={pointer} scale={scale} />}
          {active && (
            <Toolbar
              mode={mode}
              onMode={changeMode}
              onFullscreen={() => commit({ kind: 'monitor' })}
              onCancel={() => act({ type: 'cancel' })}
            />
          )}
          {active && <KeyHints />}
        </>
      )}
    </div>
  );
}
