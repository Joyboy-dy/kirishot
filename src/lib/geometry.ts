// Rectangle helpers for the overlay. Unless stated otherwise, values are physical pixels in the
// monitor's own coordinates.
import type { Rect, WindowInfo } from './ipc';

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function cssToPhysical(p: Point, scale: number): Point {
  return { x: Math.round(p.x * scale), y: Math.round(p.y * scale) };
}

/** CSS pixels for drawing; not rounded, so borders land exactly on physical pixels. */
export function physicalToCss(r: Rect, scale: number): Rect {
  return { x: r.x / scale, y: r.y / scale, width: r.width / scale, height: r.height / scale };
}

/** The rectangle between two points, whatever the drag direction. `square` keeps the larger side. */
export function rectFromPoints(a: Point, b: Point, square: boolean): Rect {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * side;
    dy = (dy < 0 ? -1 : 1) * side;
  }
  return {
    x: Math.min(a.x, a.x + dx),
    y: Math.min(a.y, a.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

export function clampRect(r: Rect, bounds: Size): Rect {
  const left = Math.max(0, r.x);
  const top = Math.max(0, r.y);
  const right = Math.min(bounds.width, r.x + r.width);
  const bottom = Math.min(bounds.height, r.y + r.height);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** Moves without changing the size, stopping at the monitor's edges. */
export function moveRect(r: Rect, dx: number, dy: number, bounds: Size): Rect {
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(0, max));
  return {
    ...r,
    x: clamp(r.x + dx, bounds.width - r.width),
    y: clamp(r.y + dy, bounds.height - r.height),
  };
}

/** Drags one handle of `origin` to `to`; dragging past the opposite side flips the rectangle. */
export function resizeRect(
  origin: Rect,
  handle: Handle,
  to: Point,
  square: boolean,
  bounds: Size,
): Rect {
  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.width;
  let bottom = origin.y + origin.height;
  if (square && handle.length === 2) {
    const anchor = {
      x: handle.includes('w') ? right : left,
      y: handle.includes('n') ? bottom : top,
    };
    return clampRect(rectFromPoints(anchor, to, true), bounds);
  }
  if (handle.includes('w')) left = to.x;
  if (handle.includes('e')) right = to.x;
  if (handle.includes('n')) top = to.y;
  if (handle.includes('s')) bottom = to.y;
  return clampRect(rectFromPoints({ x: left, y: top }, { x: right, y: bottom }, false), bounds);
}

/** Below 4×4 px a selection counts as a click (spec § 3.2). */
export function isTooSmall(r: Rect): boolean {
  return r.width < 4 || r.height < 4;
}

/** The topmost window containing `p` (lists are ordered topmost first). */
export function windowAt(windows: WindowInfo[], p: Point): WindowInfo | null {
  return (
    windows.find(
      ({ bounds: b }) => p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height,
    ) ?? null
  );
}

/** Top-left of the magnifier: below right of the cursor, flipped where it would overflow. */
export function magnifierPlacement(cursor: Point, box: Size, viewport: Size, offset = 20): Point {
  const right = cursor.x + offset + box.width <= viewport.width;
  const below = cursor.y + offset + box.height <= viewport.height;
  return {
    x: right ? cursor.x + offset : cursor.x - offset - box.width,
    y: below ? cursor.y + offset : cursor.y - offset - box.height,
  };
}
