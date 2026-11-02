import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { pixelHex } from '@/lib/frame';
import { cssToPhysical, isTooSmall, type Point } from '@/lib/geometry';
import { NO_CHANGE } from '@/lib/settings';
import { t } from '@/i18n';
import { commands, type CommitTarget, type OverlaySession, type Rect } from '@/lib/ipc';
import { flashPlan, flashRect, FLASH_MS } from './flash';
import { Magnifier } from './Magnifier';
import { SelectionLayer } from './SelectionLayer';
import { ShortcutSheet } from './ShortcutSheet';
import { Toolbar } from './Toolbar';
import { useOverlaySession } from './useOverlaySession';
import {
  cursorFor,
  initialState,
  sheetKey,
  step,
  type Ctx,
  type Mode,
  type Outcome,
  type SelEvent,
  type SelState,
} from './selection';

const KEYS = new Set([
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'r',
  'w',
  'f',
]);

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
  const [magnifier, setMagnifier] = useState(true);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [flash, setFlash] = useState<Rect | null>(null);
  const [space, setSpace] = useState(false);
  const spaceRef = useRef(false);
  const [sheet, setSheet] = useState(false);
  const sheetRef = useRef(false);
  const showSheet = (open: boolean) => {
    sheetRef.current = open;
    setSheet(open);
  };

  const setSelection = (next: SelState) => {
    selRef.current = next;
    setSel(next);
  };

  const { session, frame } = useOverlaySession(canvasRef, {
    onSession: (s) => {
      setSelection(initialState);
      setMode(s.mode);
      showSheet(false);
      setMagnifier(s.magnifier);
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
  const magnifierRef = useRef(magnifier);
  const pointerRef = useRef(pointer);
  const frameRef = useRef(frame);
  useLayoutEffect(() => {
    frameRef.current = frame;
    sessionRef.current = session;
    modeRef.current = mode;
    magnifierRef.current = magnifier;
    pointerRef.current = pointer;
  });

  const act = (outcome: Outcome) => {
    const s = sessionRef.current;
    if (!s) return;
    if (outcome.type === 'claim') report(commands.overlayClaim());
    if (outcome.type === 'cancel') report(commands.overlayCancel());
    if (outcome.type === 'commit') commitWithFlash(s, outcome.target, outcome.copyOnly ?? false);
    if (outcome.type === 'mode') rememberMode(outcome.mode);
    if (outcome.type === 'fullscreen') commitWithFlash(s, { kind: 'monitor' }, false);
  };

  // The flash plays over the zone first; Rust closes the overlays once it is over.
  const commitWithFlash = (s: OverlaySession, target: CommitTarget, copyOnly: boolean) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { duration } = flashPlan(reduced, s.flash);
    const send = () => report(commands.overlayCommit(s.captureId, target, copyOnly));
    if (duration === 0) return send();
    setFlash(flashRect(target, s));
    window.setTimeout(() => {
      setFlash(null);
      send();
    }, duration);
  };

  // The next capture starts in the mode chosen last (spec J2.1 § 2.1).
  const rememberMode = (next: Mode) => {
    setMode(next);
    report(commands.settingsUpdate({ ...NO_CHANGE, mode: next }));
  };

  const toggleMagnifier = (on: boolean) => {
    setMagnifier(on);
    report(commands.settingsUpdate({ ...NO_CHANGE, magnifier: on }));
  };

  const copyColor = () => {
    const frame = frameRef.current;
    const at = pointerRef.current;
    if (!frame || !at || !magnifierRef.current) return;
    const hex = `#${pixelHex(frame, at)}`;
    report(commands.copyText(hex));
    setCopiedHex(hex);
    window.setTimeout(() => setCopiedHex((h) => (h === hex ? null : h)), 1200);
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
  const toggleRef = useRef(toggleMagnifier);
  const copyColorRef = useRef(copyColor);
  useLayoutEffect(() => {
    dispatchRef.current = dispatch;
    toggleRef.current = toggleMagnifier;
    copyColorRef.current = copyColor;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The shortcut sheet takes ? and Échap first; while it is open, other keys do nothing.
      const sheetAction = sheetKey(e.key, sheetRef.current);
      if (sheetAction) {
        e.preventDefault();
        showSheet(sheetAction === 'toggle' ? !sheetRef.current : false);
        return;
      }
      if (sheetRef.current) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === ' ') {
        spaceRef.current = true;
        setSpace(true);
        e.preventDefault();
        return;
      }
      if (!e.ctrlKey && k === 'm') {
        e.preventDefault();
        toggleRef.current(!magnifierRef.current);
        return;
      }
      if (!e.ctrlKey && k === 'c') {
        e.preventDefault();
        copyColorRef.current();
        return;
      }
      if (!KEYS.has(k) && !(e.ctrlKey && k === 'c')) return;
      e.preventDefault();
      dispatchRef.current({ type: 'key', key: k, shift: e.shiftKey, ctrl: e.ctrlKey });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        spaceRef.current = false;
        setSpace(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
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
    rememberMode(next);
    setSelection(initialState);
  };

  // While dragging, a selection smaller than 4×4 px still shows the hovered window.
  const selRect =
    currentRect && !(sel.kind === 'dragging' && isTooSmall(currentRect)) ? currentRect : null;
  const hover =
    sel.kind === 'idle' || sel.kind === 'pressed' || sel.kind === 'dragging' ? sel.hover : null;
  const showMagnifier =
    magnifier &&
    active &&
    pointer !== null &&
    (sel.kind === 'idle' || sel.kind === 'dragging' || sel.kind === 'resizing');
  const cursor = cursorFor(
    null,
    sel.kind,
    space,
    sel.kind === 'adjusting' && pointer !== null && contains(sel.rect, pointer),
  );

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        const at = toPhysical(e);
        setPointer(at);
        dispatch({
          type: 'pointerMove',
          at,
          shift: e.shiftKey,
          alt: e.altKey,
          space: spaceRef.current,
        });
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
          {showMagnifier && (
            <Magnifier source={canvasRef} frame={frame} at={pointer} scale={scale} />
          )}
          {flash && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: flash.x / scale,
                top: flash.y / scale,
                width: flash.width / scale,
                height: flash.height / scale,
                background: '#fff',
                animation: `k-flash ${FLASH_MS}ms ease-out forwards`,
              }}
            />
          )}
          {copiedHex && pointer && (
            <div
              role="status"
              className="pointer-events-none absolute rounded-md px-2 py-1 font-mono text-[12px]"
              style={{
                left: pointer.x / scale + 16,
                top: pointer.y / scale - 32,
                background: 'rgba(14, 16, 20, 0.92)',
                color: '#eceef2',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              {t('overlay.colorCopied', { hex: copiedHex })}
            </div>
          )}
          {active && (
            <Toolbar
              mode={mode}
              position={session.toolbarPosition}
              magnifier={magnifier}
              onHelp={() => showSheet(!sheetRef.current)}
              onMagnifier={toggleMagnifier}
              onMode={changeMode}
              onFullscreen={() => commit({ kind: 'monitor' })}
              onCancel={() => act({ type: 'cancel' })}
            />
          )}
          {sheet && <ShortcutSheet onClose={() => showSheet(false)} />}
        </>
      )}
    </div>
  );
}
