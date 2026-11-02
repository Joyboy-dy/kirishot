// The selection state machine (spec § 3.2). Pure: the overlay feeds it pointer and keyboard
// events in physical pixels and acts on the returned outcome.
import {
  clampRect,
  isTooSmall,
  moveRect,
  rectFromPoints,
  resizeRect,
  windowAt,
  type Handle,
  type Point,
  type Size,
} from '@/lib/geometry';
import type { CommitTarget, Rect, WindowInfo } from '@/lib/ipc';

export type Mode = 'region' | 'window';

export type SelState =
  | { kind: 'idle'; hover: WindowInfo | null }
  | { kind: 'pressed'; hover: WindowInfo | null }
  | { kind: 'dragging'; anchor: Point; last: Point; rect: Rect; hover: WindowInfo | null }
  | { kind: 'adjusting'; rect: Rect }
  | { kind: 'moving'; rect: Rect; grab: Point; origin: Rect }
  | { kind: 'resizing'; rect: Rect; handle: Handle; origin: Rect };

export type SelEvent =
  | { type: 'pointerDown'; at: Point; handle: Handle | null; inside: boolean }
  | { type: 'pointerMove'; at: Point; shift: boolean; alt: boolean; space: boolean }
  | { type: 'pointerUp'; at: Point }
  | { type: 'doubleClick'; inside: boolean }
  | { type: 'key'; key: string; shift: boolean; ctrl: boolean }
  | { type: 'reset' };

export type Outcome =
  | { type: 'none' }
  | { type: 'claim' }
  | { type: 'cancel' }
  | { type: 'commit'; target: CommitTarget; copyOnly?: true }
  | { type: 'mode'; mode: Mode }
  | { type: 'fullscreen' };

export type Ctx = { mode: Mode; windows: WindowInfo[]; bounds: Size; commitOnRelease: boolean };

export const initialState: SelState = { kind: 'idle', hover: null };

const NONE: Outcome = { type: 'none' };
const ARROWS: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

type Result = { state: SelState; outcome: Outcome };
const stay = (state: SelState): Result => ({ state, outcome: NONE });
const commit = (target: CommitTarget): Result => ({
  state: initialState,
  outcome: { type: 'commit', target },
});
const region = (rect: Rect): Result => commit({ kind: 'region', rect });
const startDrag = (at: Point, hover: WindowInfo | null): Result => ({
  state: { kind: 'dragging', anchor: at, last: at, rect: { ...at, width: 0, height: 0 }, hover },
  outcome: { type: 'claim' },
});

const MODE_KEYS: Record<string, Outcome> = {
  r: { type: 'mode', mode: 'region' },
  w: { type: 'mode', mode: 'window' },
  f: { type: 'fullscreen' },
};

/** A rectangle from the anchor to the pointer, or centred on the anchor with Alt. */
function dragRect(anchor: Point, at: Point, square: boolean, fromCentre: boolean): Rect {
  const r = rectFromPoints(anchor, at, square);
  if (!fromCentre) return r;
  return {
    x: anchor.x - r.width,
    y: anchor.y - r.height,
    width: 2 * r.width,
    height: 2 * r.height,
  };
}

/** What a key does to the shortcut sheet: `?` opens or closes it, Échap only closes it. */
export function sheetKey(key: string, open: boolean): 'toggle' | 'close' | null {
  if (key === '?') return 'toggle';
  if (key === 'Escape' && open) return 'close';
  return null;
}

/** A window title cut to `max` characters, ellipsis included. */
export function truncateTitle(title: string, max = 60): string {
  return title.length <= max ? title : `${title.slice(0, max - 1)}…`;
}

export function step(s: SelState, e: SelEvent, ctx: Ctx): Result {
  if (e.type === 'reset') return stay(initialState);
  if (e.type === 'key' && e.key === 'Escape')
    return { state: initialState, outcome: { type: 'cancel' } };
  if (e.type === 'key' && !e.ctrl && MODE_KEYS[e.key.toLowerCase()]) {
    const outcome = MODE_KEYS[e.key.toLowerCase()];
    return { state: outcome.type === 'fullscreen' ? s : initialState, outcome };
  }

  switch (s.kind) {
    case 'idle':
      // Zone mode only draws: windows are highlighted in window mode alone (spec J2.1 § 2.1).
      if (e.type === 'pointerMove')
        return stay({
          kind: 'idle',
          hover: ctx.mode === 'window' ? windowAt(ctx.windows, e.at) : null,
        });
      if (e.type === 'pointerDown' && ctx.mode === 'region') return startDrag(e.at, null);
      // Window mode commits on a full click on the overlay: a release alone (a toolbar
      // button stops its pointerdown) must not capture the window behind the toolbar.
      if (e.type === 'pointerDown') return stay({ kind: 'pressed', hover: s.hover });
      return stay(s);

    case 'pressed':
      if (e.type === 'pointerMove')
        return stay({ kind: 'pressed', hover: windowAt(ctx.windows, e.at) });
      if (e.type === 'pointerUp') {
        const hover = windowAt(ctx.windows, e.at) ?? s.hover;
        return hover ? commit({ kind: 'window', index: hover.index }) : stay(initialState);
      }
      return stay(s);

    case 'dragging':
      if (e.type === 'pointerMove') {
        if (e.space) {
          // Space held: the rectangle follows the pointer without changing size.
          const dx = e.at.x - s.last.x;
          const dy = e.at.y - s.last.y;
          return stay({
            ...s,
            anchor: { x: s.anchor.x + dx, y: s.anchor.y + dy },
            last: e.at,
            rect: moveRect(s.rect, dx, dy, ctx.bounds),
          });
        }
        const rect = clampRect(dragRect(s.anchor, e.at, e.shift, e.alt), ctx.bounds);
        return stay({ ...s, last: e.at, rect });
      }
      if (e.type === 'pointerUp') {
        if (isTooSmall(s.rect)) return stay(initialState);
        return ctx.commitOnRelease ? region(s.rect) : stay({ kind: 'adjusting', rect: s.rect });
      }
      return stay(s);

    case 'adjusting':
      if (e.type === 'pointerDown') {
        if (e.handle)
          return stay({ kind: 'resizing', rect: s.rect, handle: e.handle, origin: s.rect });
        if (e.inside) return stay({ kind: 'moving', rect: s.rect, grab: e.at, origin: s.rect });
        return startDrag(e.at, null);
      }
      if (e.type === 'doubleClick') return e.inside ? region(s.rect) : stay(s);
      if (e.type === 'key' && e.key === 'Enter') return region(s.rect);
      if (e.type === 'key' && e.ctrl && e.key.toLowerCase() === 'c')
        return {
          state: initialState,
          outcome: { type: 'commit', target: { kind: 'region', rect: s.rect }, copyOnly: true },
        };
      if (e.type === 'key' && e.key in ARROWS) {
        const d = ARROWS[e.key];
        const by = e.shift ? 10 : 1;
        return stay({ kind: 'adjusting', rect: moveRect(s.rect, d.x * by, d.y * by, ctx.bounds) });
      }
      return stay(s);

    case 'moving':
      if (e.type === 'pointerMove') {
        const rect = moveRect(s.origin, e.at.x - s.grab.x, e.at.y - s.grab.y, ctx.bounds);
        return stay({ ...s, rect });
      }
      if (e.type === 'pointerUp') return stay({ kind: 'adjusting', rect: s.rect });
      return stay(s);

    case 'resizing':
      if (e.type === 'pointerMove') {
        return stay({ ...s, rect: resizeRect(s.origin, s.handle, e.at, e.shift, ctx.bounds) });
      }
      if (e.type === 'pointerUp') return stay({ kind: 'adjusting', rect: s.rect });
      return stay(s);
  }
}

const HANDLE_CURSOR: Record<Handle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
};

/** The pointer shape for the element under the pointer and the selection state. */
export function cursorFor(
  handle: Handle | null,
  kind: SelState['kind'],
  space: boolean,
  insideSelection: boolean,
): string {
  if (handle) return HANDLE_CURSOR[handle];
  if (kind === 'dragging' && space) return 'grabbing';
  if (kind === 'moving' || (kind === 'adjusting' && insideSelection)) return 'move';
  return 'crosshair';
}
