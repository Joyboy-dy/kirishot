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
  | { kind: 'dragging'; anchor: Point; rect: Rect; hover: WindowInfo | null }
  | { kind: 'adjusting'; rect: Rect }
  | { kind: 'moving'; rect: Rect; grab: Point; origin: Rect }
  | { kind: 'resizing'; rect: Rect; handle: Handle; origin: Rect };

export type SelEvent =
  | { type: 'pointerDown'; at: Point; handle: Handle | null; inside: boolean }
  | { type: 'pointerMove'; at: Point; shift: boolean }
  | { type: 'pointerUp'; at: Point }
  | { type: 'doubleClick'; inside: boolean }
  | { type: 'key'; key: string; shift: boolean }
  | { type: 'reset' };

export type Outcome =
  | { type: 'none' }
  | { type: 'claim' }
  | { type: 'cancel' }
  | { type: 'commit'; target: CommitTarget };

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
  state: { kind: 'dragging', anchor: at, rect: { ...at, width: 0, height: 0 }, hover },
  outcome: { type: 'claim' },
});

export function step(s: SelState, e: SelEvent, ctx: Ctx): Result {
  if (e.type === 'reset') return stay(initialState);
  if (e.type === 'key' && e.key === 'Escape')
    return { state: initialState, outcome: { type: 'cancel' } };

  switch (s.kind) {
    case 'idle':
      if (e.type === 'pointerMove')
        return stay({ kind: 'idle', hover: windowAt(ctx.windows, e.at) });
      if (e.type === 'pointerDown' && ctx.mode === 'region') return startDrag(e.at, s.hover);
      if (e.type === 'pointerUp' && ctx.mode === 'window') {
        const hover = windowAt(ctx.windows, e.at) ?? s.hover;
        return hover ? commit({ kind: 'window', index: hover.index }) : stay(s);
      }
      return stay(s);

    case 'dragging':
      if (e.type === 'pointerMove') {
        const rect = clampRect(rectFromPoints(s.anchor, e.at, e.shift), ctx.bounds);
        return stay({ ...s, rect });
      }
      if (e.type === 'pointerUp') {
        if (isTooSmall(s.rect)) {
          return s.hover ? commit({ kind: 'window', index: s.hover.index }) : stay(initialState);
        }
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
