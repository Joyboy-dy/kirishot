import { describe, expect, it } from 'vitest';
import {
  clampRect,
  cssToPhysical,
  isTooSmall,
  moveRect,
  rectFromPoints,
  resizeRect,
  windowAt,
} from './geometry';
import type { WindowInfo } from './ipc';

const B = { width: 1920, height: 1080 };
const win = (
  index: number,
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
): WindowInfo => ({
  index,
  title,
  appName: 'app',
  bounds: { x, y, width: w, height: h },
});

describe('geometry', () => {
  it('cssToPhysical rounds at 125 %', () =>
    expect(cssToPhysical({ x: 100.4, y: 10 }, 1.25)).toEqual({ x: 126, y: 13 }));

  it('rectFromPoints normalizes a reversed drag', () =>
    expect(rectFromPoints({ x: 300, y: 200 }, { x: 100, y: 50 }, false)).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 150,
    }));

  it('rectFromPoints squares with shift, following the drag direction', () =>
    expect(rectFromPoints({ x: 0, y: 0 }, { x: 50, y: -30 }, true)).toEqual({
      x: 0,
      y: -50,
      width: 50,
      height: 50,
    }));

  it('clampRect keeps the rect inside the monitor', () =>
    expect(clampRect({ x: -10, y: -10, width: 50, height: 50 }, B)).toEqual({
      x: 0,
      y: 0,
      width: 40,
      height: 40,
    }));

  it('moveRect stops at the edge', () =>
    expect(moveRect({ x: 1900, y: 0, width: 40, height: 10 }, 10, 0, B)).toEqual({
      x: 1880,
      y: 0,
      width: 40,
      height: 10,
    }));

  it('resizeRect se', () =>
    expect(
      resizeRect({ x: 100, y: 100, width: 100, height: 100 }, 'se', { x: 500, y: 400 }, false, B),
    ).toEqual({ x: 100, y: 100, width: 400, height: 300 }));

  it('resizeRect nw past the opposite corner flips', () =>
    expect(
      resizeRect({ x: 100, y: 100, width: 100, height: 100 }, 'nw', { x: 300, y: 250 }, false, B),
    ).toEqual({ x: 200, y: 200, width: 100, height: 50 }));

  it('isTooSmall', () => {
    expect(isTooSmall({ x: 0, y: 0, width: 3, height: 100 })).toBe(true);
    expect(isTooSmall({ x: 0, y: 0, width: 4, height: 4 })).toBe(false);
  });

  it('windowAt picks the topmost', () => {
    const ws = [win(0, 'Haut', 0, 0, 100, 100), win(1, 'Bas', 0, 0, 500, 500)];
    expect(windowAt(ws, { x: 50, y: 50 })?.title).toBe('Haut');
    expect(windowAt(ws, { x: 300, y: 300 })?.title).toBe('Bas');
    expect(windowAt(ws, { x: 600, y: 600 })).toBeNull();
  });
});
